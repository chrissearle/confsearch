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

var client = new pg.Client(connection);

client.connect(function (err) {
    if (err) {
        logger.error('error fetching client from pool' + err);
        return;
    }

    var data = [];

    client.query("SELECT t.id, t.title, t.description, " +
        "array_agg(distinct u.name) AS users, " +
        "array_agg(distinct tg.title) AS tags " +
        "FROM talks t " +
        "  LEFT JOIN speakers s ON (s.talk_id = t.id) " +
        "  LEFT JOIN users u ON (u.id = s.user_id) " +
        "  LEFT JOIN tags_talks tgt ON (tgt.talk_id = t.id) " +
        "  LEFT JOIN tags tg ON (tg.id = tgt.tag_id) " +
        "WHERE t.acceptance_status = 'accepted' " +
        "GROUP BY t.id, t.title, t.description;", function (err, result) {

        if (err) {
            logger.error('error running query' + err);
        }

        result.rows.forEach(function (row) {
            data.push({
                "index": {
                    "_index": "conference",
                    "_type": "session"
                }
            });

            var speakers = [];

            row.users.forEach(function (user) {
                speakers.push({"name": user});
            });

            var tags = [];

            if (row.tags) {
                row.tags.forEach(function(tag) {
                    if (tag) {
                        tags.push(tag.toLowerCase());
                    }
                });
            }

            data.push({
                "id": row.id,
                "format": "lightning-talk",
                "title": row.title,
                "content": row.description,
                "conference": {
                    "group": "Smidig",
                    "name": "Smidig " + year,
                    "venue": location
                },
                "speakers": speakers,
                "keywords": tags
            });
        });

        client.end();

        console.log(JSON.stringify(data, null, 4));
    });
});

