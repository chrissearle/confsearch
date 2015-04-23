/* global module */

module.exports = function (grunt) {
    "use strict";

    grunt.initConfig({
        eslint: {
            target: [
                "Gruntfile.js",
                "src/*.js",
                "js/*.js"
            ]
        },
        "bower-install-simple": {
            app: {
                options: {
                    color: true,
                    production: false,
                    cwd: ".",
                    directory: "webapp/lib"
                }
            }
        },
        nodemon: {
            dev: {
                script: "src/app.js"
            }
        },
        exec: {
            elastic: {
                command: "elasticsearch --config=config/elasticsearch.yml"
            },
            index: {
                command: "node src/run_index.js"
            }
        }
    });

    // Package management
    grunt.loadNpmTasks("grunt-npm-install");
    grunt.loadNpmTasks("grunt-bower-install-simple");
    grunt.loadNpmTasks("grunt-eslint");
    grunt.loadNpmTasks("grunt-nodemon");
    grunt.loadNpmTasks("grunt-exec");

    grunt.registerTask("install", ["bower-install-simple:app", "npm-install"]);
    grunt.registerTask("default", ["eslint"]);
    grunt.registerTask("run", ["nodemon"]);
    grunt.registerTask("es", ["exec:elastic"]);
    grunt.registerTask("index", ["exec:index"]);
};
