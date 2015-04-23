/* globals angular moment */

var app = angular.module("jzes");

app.controller("StatsController", ["$http", function ($http) {
    "use strict";

    var self = this;

    $http.get('/stats').
        success(function (data) {
            self.sessionCount = data["session"];
            self.conferenceCount = data["conference"];
            self.speakerCount = data["speaker"];
        }).
        error(function (data, status) {
            console.log(status + " " + data);
        });
}]);

app.controller("SearchController", ["$http", function ($http) {
    "use strict";

    var self = this;

    self.searched = false;

    self.search = function (searchFlag) {
        self.searched = searchFlag !== false;
        $http.post('/search', {query: self.searchText}).
            success(function (data) {
                self.results = data.hits;
                self.navs = data.aggs;
            }).
            error(function (data, status) {
                console.log(status + " " + data);
            });
    };

    self.search(false);
}]);
