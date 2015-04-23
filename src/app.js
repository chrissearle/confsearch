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

function search(query, res) {
    "use strict";

    elasticClient.search(
        {
            "index": "javazone",
            "q": query
        }, function (err, resp) {
            if (err) {
                logger.error(err);

                res.status(500).send(err);
            } else {
                res.setHeader("Content-Type", "application/json");

                res.json(resp.hits.hits);
            }
        }
    );
}

app.get("/stats", function (req, res) {
    "use strict";

    stats(res);
});

app.post("/search", function (req, res) {
    "use strict";

    search(req.body.query, res);
});

var port = process.env.PORT || 3000;

var server = app.listen(port, function () {
    "use strict";

    var serverHost = server.address().address;
    var serverPort = server.address().port;

    logger.info("Example app listening at http://%s:%s", serverHost, serverPort);
});
