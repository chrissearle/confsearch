/* global angular */

var app = angular.module("jzes");

app.service("SearchService", ["$http", function ($http) {
    "use strict";

    function getInfo(path, callback) {
        $http.get(path).
            success(function (data) {
                callback(data);
            }).
            error(function (data, status) {
                console.log(status + " " + data);
            });
    }

    function runSearch(queryText, filters, callback) {
        $http.post('/search', {
            query: queryText,
            filters: filters
        }).success(function (data) {
            callback(data);
        });
    }

    return {
        getInfo: getInfo,
        runSearch: runSearch
    };
}]);