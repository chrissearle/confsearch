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

