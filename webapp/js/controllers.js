/* global angular */

var app = angular.module("jzes");

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
            self.navs = data.aggs;
        });
    };

    self.addFilter = function (type, value) {
        // TODO - one per type limit

        self.filters.push({
            "type": type,
            "value": value
        });

        self.search();
    };

    self.removeFilter = function(filter) {
        // TODO

        self.filterWarning = "Not yet implemented";
    };

    self.search(false);
}]);
