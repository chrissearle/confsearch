var express = require('express');
var app = express();

app.use(express.static('webapp'));


var elasticSearch = require('elasticsearch'),
    winston = require('winston');

var host = "localhost:9200";

if (process.argv.length > 2) {
    host = process.argv[2];
}

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: 'info-file',
            filename: 'logs/web-info.log',
            level: 'info'
        }),
        new (winston.transports.File)({
            name: 'error-file',
            filename: 'logs/web-error.log',
            level: 'error'
        })
    ]
});

var elasticClient = new elasticSearch.Client({
    host: host,
    log: 'info'
});


function stats(res) {
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
                res.setHeader('Content-Type', 'application/json');

                var result = {};

                resp["aggregations"]["type_counts"]["buckets"].forEach(function (bucket) {
                    result[bucket["key"]] = bucket["doc_count"];
                });

                res.json(result);
            }
        }
    );
}


app.get('/stats', function (req, res) {
    stats(res);
});

var server = app.listen(3000, function () {

    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);

});