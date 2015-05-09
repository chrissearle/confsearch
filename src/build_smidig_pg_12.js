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

    client.query("SELECT t.id, t.title, t.description, tt.name as type, u.name as user, string_agg(tg.title, ',') AS tags from talks t, talk_types tt, users u, speakers s, tags tg, tags_talks tgt where acceptance_status='accepted' and t.talk_type_id = tt.id and t.id = s.talk_id and s.user_id = u.id and tg.id=tgt.tag_id and t.id=tgt.talk_id group by t.id, tt.name, u.name", function (err, result) {
        if (err) {
            logger.error('error running query' + err);
        }

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
                "id": row.id,
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
                "keywords": row.tags.toLowerCase().split(",")
            });
        });

        client.end();

        console.log(JSON.stringify(data, null, 4));
    });
});

