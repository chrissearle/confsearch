/* global angular */

var app = angular.module("confsearch");

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
        self.conferences = data.conference;
        self.groups = data.group;
    });
}]);

app.controller("SearchController", ["SearchService", "$location", "$anchorScroll", "$sce", function (SearchService, $location, $anchorScroll, $sce) {
    "use strict";

    var self = this;

    self.searchText = "";
    self.filters = [];
    self.page = 1;
    self.perPage = 50;

    self.search = function (resetPage) {
        if (resetPage) {
            self.page = 1;
        }

        var offset = (self.page - 1) * self.perPage;

        SearchService.runSearch(self.searchText, self.filters, offset, self.perPage, function (data) {
            self.removeVideo();

            self.count = data.count;

            var hits = [];

            data.hits.forEach(function(hit) {
                hit.expanded = false;

                if (self.count == 1) {
                    hit.expanded = true;
                }

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

            self.prevPage = (self.page > 1) ? self.page - 1 : 0;
            self.lastPage = Math.ceil(self.count / self.perPage);
            self.nextPage = (self.page < self.lastPage) ? self.page + 1 : 0;
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

        self.search(true);
    };

    self.removeFilter = function (filter) {
        self.filters = self.filters.filter(function (data) {
            return data.type != filter.type;
        });

        self.search(true);
    };

    self.expand = function (index) {
        self.results[index].expanded = true;
    };

    self.collapse = function (index) {
        self.results[index].expanded = false;
    };

    self.playVideo = function(index) {
        $location.hash("videoPlayer");
        $anchorScroll();

        self.currentVideo = $sce.trustAsResourceUrl(self.results[index].video.replace("http://vimeo.com", "//player.vimeo.com/video"));
    };

    self.removeVideo = function() {
        self.currentVideo = $sce.trustAsResourceUrl("");
    };

    self.gotoPage = function(page) {
        self.page = page;

        self.search();
    };

    self.search(true);
}]);
