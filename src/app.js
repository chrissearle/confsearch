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
            "index": "conference",
            "type": "session",
            "searchType": "count",
            "body": {
                "aggs": {
                    "conference_counts": {
                        "terms": {
                            "field": "conference.name.raw",
                            "order": {"_term": "desc"}
                        }
                    },
                    "conference_group_counts": {
                        "terms": {
                            "field": "conference.group.raw"
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

                var c_result = [];
                var g_result = [];

                resp.aggregations.conference_counts.buckets.forEach(function (bucket) {
                    c_result.push({
                        "name": bucket.key,
                        "count": bucket.doc_count
                    });
                });

                resp.aggregations.conference_group_counts.buckets.forEach(function (bucket) {
                    g_result.push({
                        "name": bucket.key,
                        "count": bucket.doc_count
                    });
                });

                res.json({
                    "conference": c_result,
                    "group": g_result
                });
            }
        }
    );
}

function stats(res) {
    "use strict";

    elasticClient.search(
        {
            "index": "conference",
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

function search(queryString, filters, from, count, res) {
    "use strict";

    var query;

    if (queryString) {
        query = {
            "multi_match": {
                "fields": [
                    "format",
                    "content",
                    "keywords",
                    "title^3",
                    "language",
                    "summary",
                    "level",
                    "conference.name",
                    "conference.venue",
                    "speakers.name"
                ],
                "query": queryString,
                "type": "cross_fields"
            }
        };
    } else {
        query = {
            "match_all": {}
        };
    }

    var body = {
        "aggs": {
            "conference.group.raw_counts": {
                "terms": {
                    "field": "conference.group.raw",
                    "size": "5"
                }
            },
            "conference.name.raw_counts": {
                "terms": {
                    "field": "conference.name.raw",
                    "size": 30
                }
            },
            "speakers.name.raw_counts": {
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
            },
            "video_counts": {
                "value_count": {
                    "field": "video"
                }
            }
        }
    };

    if (filters.length > 0) {
        // TODO - multiple

        var filterList = [];

        filters.forEach(function (f) {
            if (f.type === "video") {
                if (f.value === "Video") {
                    filterList.push({
                        "exists": {
                            "field": "video"
                        }
                    });
                }

                if (f.value === "No video") {
                    filterList.push({
                        "missing": {
                            "field": "video"
                        }
                    });
                }
            } else {
                var item = {
                    "term": {}
                };

                item.term[f.type] = f.value;

                filterList.push(item);
            }
        });

        var filter;

        if (filterList.length === 1) {
            filter = filterList[0];
        } else {
            filter = {
                "bool": {
                    "must": filterList
                }
            };
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

    //console.log(JSON.stringify(body, null, 4));

    elasticClient.search(
        {
            "index": "conference",
            "type": "session",
            "from": from,
            "size": count,
            "body": body
        }, function (err, resp) {
            if (err) {
                logger.error(err);

                res.status(500).send(err);
            } else {
                res.setHeader("Content-Type", "application/json");

                // console.log(JSON.stringify(resp, null, 4));

                var result = {};

                result.hits = [];

                resp.hits.hits.forEach(function (hit) {
                    /* eslint-disable no-underscore-dangle */
                    var processedHit = hit._source;
                    processedHit.type = hit._type;
                    /* eslint-disable no-underscore-dangle */

                    result.hits.push(processedHit);
                });

                result.aggs = [];

                for (var aggregationName in resp.aggregations) {
                    if (aggregationName === "video_counts") {
                        result.aggs.push({
                            "name": aggregationName,
                            "data": [
                                {
                                    "key": "Video",
                                    "doc_count": resp.aggregations[aggregationName].value
                                },
                                {
                                    "key": "No video",
                                    "doc_count": resp.hits.total - resp.aggregations[aggregationName].value
                                }
                            ]
                        });
                    } else {
                        result.aggs.push({
                            "name": aggregationName,
                            "data": resp.aggregations[aggregationName].buckets
                        });
                    }
                }

                result.count = resp.hits.total;

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

    search(req.body.query, req.body.filters, req.body.from || 0, req.body.count || 50, res);
});

var port = process.env.PORT || 3000;

var server = app.listen(port, function () {
    "use strict";

    var serverHost = server.address().address;
    var serverPort = server.address().port;

    logger.info("Example app listening at http://%s:%s", serverHost, serverPort);
});
