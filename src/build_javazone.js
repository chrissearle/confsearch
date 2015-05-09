/* globals require, process */

var fs = require("fs"),
    http = require("http"),
    winston = require("winston"),
    async = require("async");

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: "info-file",
            filename: "logs/javazone-info.log",
            level: "info"
        }),
        new (winston.transports.File)({
            name: "error-file",
            filename: "logs/javazone-error.log",
            level: "error"
        })
    ]
});

var output = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)()
    ]
});

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

function handleSpeaker(data, session, callback) {
    "use strict";

    getJson(data.href, function (items) {


        var speaker = {
            "link": items.collection.href,
            "name": getData(items.collection.items[0], "name"),
            "bio": getData(items.collection.items[0], "bio"),
            "avatar": getLink(items.collection.items[0], "thumbnail")
        };

        callback(session, speaker);
    });
}

function handleSession(data, conference) {
    "use strict";

    var items = data.collection.items;

    if (!items) {
        return;
    }

    var sessions = [];

    var speakerList = [];

    var bulkSessions = [];

    async.series([
            function (callback) {
                items.forEach(function (item) {
                    var session = {
                        "link": item.href,
                        "format": getData(item, "format"),
                        "content": getData(item, "body"),
                        "keywords": getData(item, "keywords", "array"),
                        "title": getData(item, "title"),
                        "language": getData(item, "lang"),
                        "summary": getData(item, "summary"),
                        "level": getData(item, "level"),
                        "conference": conference,
                        "speakers": []
                    };

                    var video = getLink(item, "alternate video");

                    if (video) {
                        session.video = video;
                    }

                    var speakers = item.links.filter(function (link) {
                        return link.rel === "speaker item";
                    });

                    speakers.forEach(function (speaker) {
                        speaker.session = item.href;

                        speakerList.push(speaker);
                    });

                    sessions.push(session);
                });

                callback(null, "Done");
            },
            function (callback) {
                async.each(speakerList, function (speaker, innerCallback) {
                    handleSpeaker(speaker, speaker.session, function (sessionLink, fullSpeaker) {
                        for (var i = 0; i < sessions.length; i++) {
                            if (sessions[i].link === sessionLink) {

                                sessions[i].speakers.push(fullSpeaker);
                            }
                        }

                        innerCallback(null);
                    });
                }, function (err) {
                    callback(err, "Done");
                });

            },
            function (callback) {
                sessions.forEach(function (session) {
                    bulkSessions.push({
                        "index": {
                            "_index": "conference",
                            "_type": "session"
                        }
                    });
                    bulkSessions.push(session);
                });

                callback(null, "Done");
            },
            function (callback) {
                var year = conference.name.replace(/.* /, "");

                writeJsonToFile("static_data/javazone-sessions-" + year + ".json", bulkSessions, callback);
            }
        ],
        function (err, data) {
            if (err) {
                logger.error(err);
            }

            logger.info(data);
        });
}

function writeJsonToFile(path, json, callback) {
    fs.writeFile(path, JSON.stringify(json, null, 4), function (err) {
        if (err) {
            logger.error("Unable to write docs file " + err);
        }

        if (callback) {
            callback(err, "Done");
        }
    });
}

function handleEvents(data) {
    "use strict";

    var items = data.collection.items;

    var events = [];

    var control = {
        "index": {
            "_index": "conference",
            "_type": "conference"
        }
    };

    items.forEach(function (item) {
        var conference = {
            "name": getData(item, "name"),
            "venue": getData(item, "venue"),
            "group": "JavaZone"
        };

        events.push(control);
        events.push(conference);

        getJson(getLink(item, "session collection"), function (sessionData) {
            conference.link = item.href;
            handleSession(sessionData, conference);
        });

    });

    writeJsonToFile("static_data/javazone-conferences.json", events);
}

getJson("http://javazone.no/ems/server/events", handleEvents);
