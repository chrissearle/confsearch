/* globals require, process */

var fs = require("fs"),
    http = require("http"),
    elasticSearch = require("elasticsearch"),
    winston = require("winston"),
    async = require("async");


var host = "localhost:9200";

if (process.argv.length > 2) {
    host = process.argv[2];
}

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: "info-file",
            filename: "logs/info.log",
            level: "info"
        }),
        new (winston.transports.File)({
            name: "error-file",
            filename: "logs/error.log",
            level: "error"
        })
    ]
});

var output = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ]
});

var elasticClient = new elasticSearch.Client({
    host: host,
    log: "info"
});

function elasticResponse(error, response) {
    "use strict";

    if (error) {
        logger.error("Error: " + error);
    }

    logger.info(response);
}

function putMapping(data, type, callback) {
    "use strict";

    elasticClient.indices.putMapping({
        index: "conference",
        type: type,
        body: data
    }, function (err, response) {
        if (callback) {
            callback(err, response);
        }
    });
}

function getJson(url, callback) {
    "use strict";

    http.get(url, function (res) {
        var body = "";

        res.on("data", function (chunk) {
            body += chunk;
        });

        res.on("end", function () {
            callback(JSON.parse(body));
        });
    }).on("error", function (e) {
        logger.error("Got error: ", e);
    });
}

function getLink(item, rel) {
    "use strict";

    var link = item.links.filter(function (l) {
        return l.rel === rel;
    });

    if (link.length > 0) {
        return link[0].href;
    }

    return "";
}

function getData(item, name, fieldName) {
    "use strict";

    fieldName = fieldName || "value";

    var datum = item.data.filter(function (data) {
        return data.name === name;
    });

    if (datum.length > 0) {
        return datum[0][fieldName];
    }

    return "";
}

function readJsonFromFile(path, callback) {
    "use strict";

    fs.readFile(path, null, function (err, data) {
        if (err) {
            logger.error(err);
        } else {
            callback(JSON.parse(data));
        }
    });
}

function handleSpeaker(data, conference, session) {
    "use strict";

    var items = data.collection.items;

    if (!items) {
        return;
    }

    // TODO - need to put conf and session into body - but need to _merge_ if already exists

    items.forEach(function (item) {
        elasticClient.index({
            index: "conference",
            type: "speaker",
            id: item.href,
            body: {
                "name": getData(item, "name"),
                "bio": getData(item, "bio")
            }
        }, function (err, response) {
            elasticResponse(err, response);
        });
    });
}

function handleSession(data, conference) {
    "use strict";

    var items = data.collection.items;

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

        var video = getLink(item, "alternate video");

        if (video) {
            session.video = video;
        }

        var speakers = item.links.filter(function (link) {
            return link.rel === "speaker item";
        });

        var speakerContent = [];

        speakers.forEach(function (speaker) {
            speakerContent.push({
                "name": speaker.prompt,
                "link": speaker.href
            });
        });

        session.speakers = speakerContent;

        elasticClient.index({
            index: "conference",
            type: "session",
            id: item.href,
            body: session
        }, function (err, response) {
            elasticResponse(err, response);

            var speakerLink = getLink(item, "speaker collection");

            if (speakerLink) {
                getJson(speakerLink, function (speakerData) {
                    session.link = item.href;
                    delete session.content;
                    delete session.summary;
                    delete session.conference;

                    handleSpeaker(speakerData, conference, session);
                });
            }
        });
    });
}

function handleEvents(data) {
    "use strict";

    var items = data.collection.items;

    items.forEach(function (item) {
        var conference = {
            "name": getData(item, "name"),
            "venue": getData(item, "venue"),
            "group": "Javazone"
        };

        elasticClient.index({
            index: "conference",
            type: "conference",
            id: item.href,
            body: conference
        }, function (err, response) {
            elasticResponse(err, response);

            getJson(getLink(item, "session collection"), function (sessionData) {
                conference.link = item.href;
                handleSession(sessionData, conference);
            });
        });
    });
}

function deleteIndex(callback) {
    "use strict";

    output.info("1.1: Check For Existing Index");
    elasticClient.indices.exists({
        "index": "conference"
    }, function (err, response) {
        if (err) {
            callback(err, response);
        } else {
            if (response) {
                output.info("1.2: Delete Index");
                elasticClient.indices.delete({
                    index: "conference"
                }, function (err, response) {
                    callback(err, response);
                });
            } else {
                callback(err, response);
            }
        }
    });
}

function createIndex(callback) {
    "use strict";

    output.info("2: Create Index");
    elasticClient.indices.create({
        index: "conference"
    }, function (err, response) {
        callback(err, response);
    });
}

function createMapping(type, path, callback) {
    "use strict";

    output.info("3.1: Create " + type + " mapping");
    readJsonFromFile(path, function (data) {
        putMapping(data, type, function (err, resp) {
            callback(err, resp);
        });
    });
}

function indexJavazone(callback) {
    "use strict";

    output.info("4: Index Javazone");
    getJson("http://javazone.no/ems/server/events", handleEvents);
    callback(null, "Done");
}

function loadFile(path, type, callback) {
    "use strict";

    output.info("4.1: Index file: " + path);

    readJsonFromFile(path, function (data) {
        data.forEach(function (item) {
            elasticClient.index({
                index: "conference",
                type: type,
                body: item
            }, function (err, response) {
                elasticResponse(err, response);
            });
        });
        callback(null, "Done");
    });
}

function indexFlatMap(outerCallback) {
    "use strict";

    output.info("4: Index files");

    async.parallel([
            function (callback) {
                loadFile("static_data/smidig-conferences.json", "conference", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2013.json", "session", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2014.json", "session", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-conferences.json", "conference", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-sessions-2013.json", "session", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-sessions-2015.json", "session", callback)
            }
        ],
        outerCallback
    );
}

function logResult(err, resp) {
    "use strict";

    if (err) {
        logger.error(err);
    }

    logger.info(resp);
}


async.series([
        deleteIndex,
        createIndex,
        function (outerCallback) {
            "use strict";

            async.parallel([
                    function (callback) {
                        createMapping("conference", "config/conference_mapping.json", callback);
                    },
                    function (callback) {
                        createMapping("session", "config/session_mapping.json", callback);
                    },
                    function (callback) {
                        createMapping("speaker", "config/speaker_mapping.json", callback);
                    }
                ],
                outerCallback
            );
        },
        function (outerCallback2) {
            "use strict";
            async.parallel([
                    function (callback) {
                        indexJavazone(callback);
                    },
                    function (callback) {
                        indexFlatMap(callback);
                    }
                ],
                outerCallback2
            );
        }
    ],
    logResult
);

