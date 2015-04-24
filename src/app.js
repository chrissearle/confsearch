/* globals require, process */

var express = require("express");
var app = express();
var bodyParser = require("body-parser");

app.use(express.static("webapp"));

app.use(bodyParser.json());

var elasticSearch = require("elasticsearch"),
    winston = require("winston");

var host = process.env.BONSAI_URL || "localhost:9200";

var logflag = process.env.LOG_CONSOLE || false;

var logger;

if (logflag) {
    logger = new (winston.Logger)({
        transports: [
            new (winston.transports.Console)()
        ]
    });
} else {
    logger = new (winston.Logger)({
        transports: [
            new (winston.transports.File)({
                name: "info-file",
                filename: "logs/web-info.log",
                level: "info"
            }),
            new (winston.transports.File)({
                name: "debug-file",
                filename: "logs/web-debug.log",
                level: "debug"
            }),
            new (winston.transports.File)({
                name: "error-file",
                filename: "logs/web-error.log",
                level: "error"
            })
        ]
    });
}

var elasticClient = new elasticSearch.Client({
    host: host,
    log: "info"
});

function conferences(res) {
    "use strict";

    elasticClient.search(
        {
            "index": "javazone",
            "type": "session",
            "searchType": "count",
            "body": {
                "aggs": {
                    "conference_counts": {
                        "terms": {
                            "field": "conference.name.raw",
                            "order": {"_term": "desc"}
                        }
                    }
                }
            }
        }, function (err, resp) {
            if (err) {
                logger.error(err);

                res.status(500).send(err);
            } else {
                res.setHeader("Content-Type", "application/json");

                var result = [];

                resp.aggregations.conference_counts.buckets.forEach(function (bucket) {
                    result.push({
                        "name": bucket.key,
                        "count": bucket.doc_count
                    });
                });

                res.json(result);
            }
        }
    );
}

function stats(res) {
    "use strict";

    elasticClient.search(
        {
            "index": "javazone",
            "searchType": "count",
            "body": {
                "aggs": {
                    "type_counts": {
                        "terms": {
                            "field": "_type"
                        }
                    }
                }
            }
        }, function (err, resp) {
            if (err) {
                logger.error(err);

                res.status(500).send(err);
            } else {
                res.setHeader("Content-Type", "application/json");

                var result = {};

                resp.aggregations.type_counts.buckets.forEach(function (bucket) {
                    result[bucket.key] = bucket.doc_count;
                });

                res.json(result);
            }
        }
    );
}

function search(queryString, filters, res) {
    "use strict";

    var query;

    if (queryString) {
        query = {
            "multi_match": {
                "fields": [
                    "format",
                    "content^20",
                    "keywords",
                    "title^100",
                    "language",
                    "summary",
                    "level",
                    "conference.name",
                    "conference.venue",
                    "speakers.name^50"
                ],
                "query": queryString,
                "type": "phrase_prefix"
            }
        };
    } else {
        query = {
            "match_all": {}
        }
    }


    var body = {
        "aggs": {
            "conference.name.raw_counts": {
                "terms": {
                    "field": "conference.name.raw",
                    "size": 30
                }
            },
            "speaker.name.raw_counts": {
                "terms": {
                    "field": "speakers.name.raw",
                    "size": 15
                }
            },
            "format.raw_counts": {
                "terms": {
                    "field": "format.raw"
                }
            },
            "keywords.raw_counts": {
                "terms": {
                    "field": "keywords.raw"
                }
            },
            "language.raw_counts": {
                "terms": {
                    "field": "language.raw"
                }
            },
            "level_counts": {
                "terms": {
                    "field": "level"
                }
            }
        }
    };

    if (filters.length > 0) {
        // TODO - multiple

        var filterList = [];

        filters.forEach(function(f) {
            var filter = {
                "term": {}
            };

            filter.term[f.type] = f.value;

            filterList.push(filter);
        });

        var filter;

        if (filterList.length == 1) {
            filter = filterList[0];
        } else {
            filter = {
                "bool": {
                    "must": filterList
                }
            }
        }

        body.query = {
            "filtered": {
                "query": query,
                "filter": filter
            }
        };
    } else {
        body.query = query;
    }

    // console.log(JSON.stringify(body, null, 4));

    elasticClient.search(
        {
            "index": "javazone",
            "type": "session",
            "body": body
        }, function (err, resp) {
            if (err) {
                logger.error(err);

                res.status(500).send(err);
            } else {
                res.setHeader("Content-Type", "application/json");

                var result = {};

                result.hits = [];

                resp.hits.hits.forEach(function (hit) {
                    var processedHit = hit._source;
                    processedHit.type = hit._type;

                    result.hits.push(processedHit);
                });

                result.aggs = [];

                for (var aggregation_name in resp.aggregations) {
                    result.aggs.push({
                        "name": aggregation_name,
                        "data": resp.aggregations[aggregation_name].buckets
                    });
                }

                res.json(result);
            }
        }
    );
}

app.get("/stats", function (req, res) {
    "use strict";

    stats(res);
});

app.get("/conferences", function (req, res) {
    "use strict";

    conferences(res);
});

app.post("/search", function (req, res) {
    "use strict";

    search(req.body.query, req.body.filters, res);
});

var port = process.env.PORT || 3000;

var server = app.listen(port, function () {
    "use strict";

    var serverHost = server.address().address;
    var serverPort = server.address().port;

    logger.info("Example app listening at http://%s:%s", serverHost, serverPort);
});
