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
    var link = item["links"].filter(function (link) {
        return link["rel"] === rel;
    });

    if (link.length > 0) {
        return link[0]["href"];
    }

    return "";
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

function handle_speaker(data, conference, session) {
    var items = data["collection"]["items"];

    if (!items) {
        return;
    }

    // TODO - need to put conf and session into body - but need to _merge_ if already exists
    items.forEach(function (item) {
        elasticClient.index({
            index: 'javazone',
            type: 'speaker',
            id: item["href"],
            body: {
                "name": getData(item, "name"),
                "bio": getData(item, "bio")
            }
        }, function (err, response) {
            elasticResponse(err, response);
        });
    });
}

function handle_session(data, conference) {
    var items = data["collection"]["items"];

    if (!items) {
        return;
    }

    items.forEach(function (item) {
        var session = {
            "format": getData(item, "format"),
            "content": getData(item, "body"),
            "keywords": getData(item, "keywords", "array"),
            "title": getData(item, "title"),
            "language": getData(item, "lang"),
            "summary": getData(item, "summary"),
            "level": getData(item, "level"),
            "conference": conference
        };


        var speakers = item["links"].filter(function (link) {
                return link["rel"] === "speaker item";
            });

        var speakerContent = [];

        speakers.forEach(function(speaker) {
            speakerContent.push({
                "name": speaker["prompt"],
                "link": speaker["href"]
            });
        });

        session["speakers"] = speakerContent;

        elasticClient.index({
            index: 'javazone',
            type: 'session',
            id: item["href"],
            body: session
        }, function (err, response) {
            elasticResponse(err, response);

            var speakers = getLink(item, "speaker collection");

            if (speakers) {
                getJson(speakers, function (data) {
                    session["link"] = item["href"];
                    delete session["content"];
                    delete session["summary"];
                    delete session["conference"];

                    handle_speaker(data, conference, session);
                });
            }
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

function deleteIndex(callback) {
    console.log("1: Delete Index");
    elasticClient.indices.delete({
        index: 'javazone'
    }, function (err, response) {
        callback(err, response);
    });
}

function createIndex(callback) {
    console.log("2: Create Index");
    elasticClient.indices.create({
        index: 'javazone'
    }, function (err, response) {
        callback(err, response);
    });
}

function createMapping(type, path, callback) {
    console.log("3.1: Create " + type + " mapping");
    readJsonFromFile(path, function (data) {
        putMapping(data, type, function (err, resp) {
            callback(err, resp);
        });
    });
}

function index(callback) {
    console.log("4: Index");
    getJson("http://javazone.no/ems/server/events", handle_events);
    callback(null, "Done");
}

function logResult(err, resp) {
    if (err) {
        logger.error(err);
    }

    logger.info(resp);
}


async.series([
        deleteIndex,
        createIndex,
        function (callback) {
            async.parallel([
                    function (callback) {
                        createMapping('conference', "config/conference_mapping.json", callback);
                    },
                    function (callback) {
                        createMapping('session', "config/session_mapping.json", callback);
                    },
                    function (callback) {
                        createMapping('speaker', "config/speaker_mapping.json", callback);
                    }
                ],
                callback
            );
        },
        index
    ],
    logResult
);

