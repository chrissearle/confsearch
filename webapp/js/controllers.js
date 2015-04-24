/* global angular */

var app = angular.module("jzes");

String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.endsWith = function (suffix) {
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

    self.searchText = "";
    self.filters = [];


    self.search = function () {
        SearchService.runSearch(self.searchText, self.filters, function (data) {
            var hits = [];

            data.hits.forEach(function(hit) {
                hit.expanded = false;

                hits.push(hit);
            });

            self.results = hits;

            var aggs = data.aggs;
            var navs = [];

            aggs.forEach(function (agg) {
                var name = agg.name.replace("_counts", "");

                var type = name.toLowerCase();

                var filterCount = self.filters.filter(function (data) {
                    return data.type === type;
                });

                if (filterCount == 0) {

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
                }
            });

            self.navs = navs;

            self.count = data.count;
        });
    };

    self.addFilter = function (type, value) {
        var filters = self.filters.filter(function (data) {
            return data.type !== type;
        });

        filters.push({
            "type": type,
            "value": value
        });

        self.filters = filters;

        self.search();
    };

    self.removeFilter = function (filter) {
        self.filters = self.filters.filter(function (data) {
            return data.type != filter.type;
        });

        self.search();
    };

    self.expand = function (index) {
        self.results[index].expanded = true;
    };

    self.collapse = function (index) {
        self.results[index].expanded = false;
    };

    self.search();
}]);
