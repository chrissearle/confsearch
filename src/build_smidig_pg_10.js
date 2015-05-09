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

    client.query("SELECT t.id, t.title, t.description, u.name as user, string_agg(tg.title, ',') AS tags from talks t, users u, speakers s, tags tg, tags_talks tgt where acceptance_status='accepted' and t.id = s.talk_id and s.user_id = u.id and tg.id=tgt.tag_id and t.id=tgt.talk_id group by t.id, u.name", function (err, result) {
        if (err) {
            logger.error('error running query' + err);
        }

        result.rows.forEach(function (row) {
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
                "speakers": [
                    {
                        "name": row.user
                    }
                ],
                "keywords": row.tags.toLowerCase().split(",")
            });
        });

        client.end();

        console.log(JSON.stringify(data, null, 4));
    });
});

