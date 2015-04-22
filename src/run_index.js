var fs = require('fs'),
    http = require('http'),
    elasticSearch = require('elasticsearch'),
    winston = require('winston'),
    async = require('async');


var host = "localhost:9200";

if (process.argv.length > 2) {
    host = process.argv[2];
}

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: 'info-file',
            filename: 'logs/info.log',
            level: 'info'
        }),
        new (winston.transports.File)({
            name: 'error-file',
            filename: 'logs/error.log',
            level: 'error'
        })
    ]
});

var elasticClient = new elasticSearch.Client({
    host: host,
    log: 'info'
});

function elasticResponse(error, response) {
    if (error) {
        logger.error("Error: " + error);
    }

    logger.info(response);
}

function putMapping(data, type, callback) {
    elasticClient.indices.putMapping({
        index: 'javazone',
        type: type,
        body: data
    }, function (err, response) {
        if (callback) {
            callback(err, response);
        }
    });
}

function getJson(url, callback) {
    http.get(url, function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            callback(JSON.parse(body));
        });
    }).on('error', function (e) {
        logger.error("Got error: ", e);
    });
}

function getLink(item, rel) {
    return item["links"].filter(function (link) {
        return link["rel"] === rel;
    })[0]["href"];
}

function getData(item, name, fieldName) {
    fieldName = fieldName || 'value';

    var datum = item["data"].filter(function (data) {
        return data["name"] === name;
    });

    if (datum.length > 0) {
        return datum[0][fieldName];
    }

    return "";
}

function readJsonFromFile(path, callback) {
    fs.readFile(path, null, function (err, data) {
        if (err) {
            logger.error(err);
        } else {
            callback(JSON.parse(data));
        }
    });
}

function handle_session(data, conference) {
    var items = data["collection"]["items"];

    if (!items) {
        return;
    }

    items.forEach(function (item) {
        elasticClient.index({
            index: 'javazone',
            type: 'session',
            id: item["href"],
            body: {
                "format": getData(item, "format"),
                "content": getData(item, "body"),
                "keywords": getData(item, "keywords", "array"),
                "title": getData(item, "title"),
                "language": getData(item, "lang"),
                "summary": getData(item, "summary"),
                "level": getData(item, "level"),
                "conference": conference
            }
        }, function (err, response) {
            elasticResponse(err, response);
        });
    });
}

function handle_events(data) {
    var items = data["collection"]["items"];

    items.forEach(function (item) {
        var conference = {
            "name": getData(item, "name"),
            "venue": getData(item, "venue")
        };

        elasticClient.index({
            index: 'javazone',
            type: 'conference',
            id: item["href"],
            body: conference
        }, function (err, response) {
            elasticResponse(err, response);

            getJson(getLink(item, "session collection"), function (data) {
                conference["link"] = item["href"];
                handle_session(data, conference);
            });
        });
    });
}

async.series([
        function (callback) {
            console.log("1: Delete Index");
            elasticClient.indices.delete({
                index: 'javazone'
            }, function (err, response) {
                callback(err, response);
            });
        },
        function (callback) {
            console.log("2: Create Index");
            elasticClient.indices.create({
                index: 'javazone'
            }, function (err, response) {
                callback(err, response);
            });
        },
        function (callback) {
            console.log("3: Create Mappings");
            async.parallel([
                    function (callback) {
                        console.log("3.1: Create Conference Mapping");
                        readJsonFromFile("config/conference_mapping.json", function (data) {
                            putMapping(data, 'conference', function (err, resp) {
                                callback(err, resp);
                            });
                        });
                    },
                    function (callback) {
                        console.log("3.2: Create Session Mapping");
                        readJsonFromFile("config/session_mapping.json", function (data) {
                            putMapping(data, 'session', function (err, resp) {
                                callback(err, resp);
                            });
                        });
                    }],
                function (err, resp) {
                    callback(err, resp);
                }
            );
        },
        function (callback) {
            console.log("4: Index");
            getJson("http://javazone.no/ems/server/events", handle_events);
            callback(null, "Done");
        }],
    function (err, resp) {
        if (err) {
            logger.error(err);
        }

        logger.info(resp);
    }
);

