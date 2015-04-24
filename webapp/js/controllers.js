/* global angular */

var app = angular.module("jzes");

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

app.controller("StatsController", ["SearchService", function (SearchService) {
    "use strict";

    var self = this;

    SearchService.getInfo("/stats", function (data) {
        self.sessionCount = data["session"];
        self.conferenceCount = data["conference"];
        self.speakerCount = data["speaker"];
    });
}]);

app.controller("MenuController", ["SearchService", function (SearchService) {
    "use strict";

    var self = this;

    SearchService.getInfo("/conferences", function (data) {
        self.conferences = data;
    });
}]);

app.controller("SearchController", ["SearchService", function (SearchService) {
    "use strict";

    var self = this;

    self.searched = false;

    self.searchText = "";
    self.filters = [];


    self.search = function (searchFlag) {
        self.searched = searchFlag !== false;

        SearchService.runSearch(self.searchText, self.filters, function (data) {
            self.results = data.hits;

            var aggs = data.aggs;
            var navs = [];

            aggs.forEach(function(agg) {
                var name = agg.name.replace("_counts", "");

                var type = name.toLowerCase();

                name = name.replace(".raw", "");

                if (name.endsWith(".name")) {
                    name = name.replace(".name", "");
                }

                if (!name.endsWith("s")) {
                    name = name + "s";
                }

                agg.type = type;
                agg.name = name.capitalize();

                navs.push(agg);
            });

            self.navs = navs;
        });
    };

    self.addFilter = function (type, value) {
        // TODO - one per type limit

        self.filters.push({
            "type": type,
            "value": value
        });

        if (self.filters.length > 1) {
            self.filterWarning = "Multiple filters not yet implemented - only the first will be applied";
        }

        self.search();
    };

    self.removeFilter = function(filter) {
        // TODO

        self.filterWarning = "Not yet implemented";
    };

    self.search(false);
}]);
