var pg = require('pg'),
    winston = require("winston");

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            name: "info-file",
            filename: "logs/smidig-info.log",
            level: "info"
        }),
        new (winston.transports.File)({
            name: "error-file",
            filename: "logs/smidig-error.log",
            level: "error"
        })
    ]
});

var connection = "";
var year = "";
var location = "";

if (process.argv.length > 4) {
    connection = process.argv[2];
    year = process.argv[3];
    location = process.argv[4];
} else {
    process.exit(1);
}

pg.connect(connection, function (err, client, done) {
    if (err) {
        logger.error('error fetching client from pool' + err);
        return;
    }
    client.query("SELECT t.title, t.description, tt.name as type, tc.name as category, u.name as user from talks t, talk_types tt, talk_categories tc, users u where status='approved_and_confirmed' and t.talk_type_id = tt.id and t.talk_category_id = tc.id and t.user_id = u.id", function (err, result) {
        done();

        if (err) {
            logger.error('error running query', err);
        }

        var data = [];

        result.rows.forEach(function (row) {
            if (row.type === "Lyntale") {
                row.type = "lightning-talk";
            }
            if (row.type === "Keynote") {
                row.type = "presentation";
            }
            if (row.type === "Ekstra lang workshop") {
                row.type = "workshop";
            }
            if (row.type === "Foredrag") {
                row.type = "presentation";
            }
            if (row.type === "Kort foredrag") {
                row.type = "presentation";
            }
            if (row.type === "Kort workshop") {
                row.type = "workshop";
            }
            if (row.type === "Lang workshop") {
                row.type = "workshop";
            }

            data.push({
                "index": {
                    "_index": "conference",
                    "_type": "session"
                }
            });

            data.push({
                "format": row.type,
                "title": row.title,
                "content": row.description,
                "conference": {
                    "group": "Smidig",
                    "name": "Smidig " + year,
                    "venue": location
                },
                "speakers": [
                    {
                        "name": row.user
                    }
                ],
                "keywords": [
                    row.category
                ]
            });
        });

        console.log(JSON.stringify(data, null, 4));

        process.exit(0);
    });
});