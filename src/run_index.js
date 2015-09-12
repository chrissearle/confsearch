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

function indexItem(iter, item, callback) {
    iter = iter + 1;

    elasticClient.index(item, function (err, response) {
        if (err) {
            if (iter < 3) {
                indexItem(iter, item, callback);
            } else {
                callback(err, response);
            }
        } else {
            callback(err, response);
        }
    });

}

function loadFile(path, callback) {
    "use strict";

    output.info("4.1: Index file: " + path);

    readJsonFromFile(path, function (data) {
        elasticClient.bulk({
            body: data
        }, function (err, response) {
            if (err) {
                logger.error("Unable to index item " + JSON.stringify(data) + " with error " + err);
            }
            logger.info("Indexed " + response);

            callback(err, response);
        });
    });
}

function loadIndexFiles(outerCallback) {
    "use strict";

    output.info("4: Index files");

    async.series([
            function (callback) {
                loadFile("static_data/javazone-conferences.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2008.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2009.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2010.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2011.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2012.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2013.json", callback)
            },
            function (callback) {
                loadFile("static_data/javazone-sessions-2014.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-conferences.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2010.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2011.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2012.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2013.json", callback)
            },
            function (callback) {
                loadFile("static_data/smidig-sessions-2014.json", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-conferences.json", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-sessions-2013.json", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-sessions-2014.json", callback)
            },
            function (callback) {
                loadFile("static_data/flatmap-sessions-2015.json", callback)
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
        function (callback) {
            createMapping("conference", "config/conference_mapping.json", callback);
        },
        function (callback) {
            createMapping("session", "config/session_mapping.json", callback);
        },
        function (callback) {
            createMapping("speaker", "config/speaker_mapping.json", callback);
        },
        loadIndexFiles
    ],
    logResult
);

