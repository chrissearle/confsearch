var fs = require('fs'),
    http = require('http'),
    elasticSearch = require('elasticsearch'),
    winston = require('winston');

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
    host: 'localhost:9200',
    log: 'info'
});

function elasticResponse(error, response, callback) {
    if (error) {
        logger.error("Error: " + error);
    }

    logger.info(response);

    if (callback) {
        callback();
    }
}

function putMapping(data, type) {
    elasticClient.indices.putMapping({
        index: 'javazone',
        type: type,
        body: data
    }, function (err, response) {
        elasticResponse(err, response);
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

function writeJsonToFile(path, json) {
    fs.writeFile(path, JSON.stringify(json, null, 4), function (err) {
        if (err) {
            logger.error("Unable to write docs file " + err);
        }
    });
}

function writeArrayToTextFile(path, list) {
    var urlFile = fs.createWriteStream(path);

    urlFile.on("error", function (err) {
        logger.error("Unable to write url file " + err);
    });

    list.forEach(function (line) {
        urlFile.write(line + '\n');
    });

    urlFile.end();
}

function handle_session(data) {
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
                "level": getData(item, "level")
            }
        }, function (err, response) {
            elasticResponse(err, response);
        });
    });
}

function handle_events(data) {
    var items = data["collection"]["items"];

    items.forEach(function (item) {
        elasticClient.index({
            index: 'javazone',
            type: 'conference',
            id: item["href"],
            body: {
                "name": getData(item, "name"),
                "venue": getData(item, "venue")
            }
        }, function (err, response) {
            elasticResponse(err, response);
        });

        getJson(getLink(item, "session collection"), handle_session);
    });
}

elasticClient.indices.delete({
    index: 'javazone'
}, function (err, response) {
    elasticResponse(err, response, function () {
        elasticClient.indices.create({
            index: 'javazone'
        }, function (err, response) {
            elasticResponse(err, response, function () {
                readJsonFromFile("config/conference_mapping.json", function (data) {
                    putMapping(data, 'conference');
                });
                readJsonFromFile("config/session_mapping.json", function (data) {
                    putMapping(data, 'session');
                });
            });
        });
    });
});

getJson("http://javazone.no/ems/server/events", handle_events);
