"use strict";

angular.module('uebb.hateoas')
    .factory('Promise', function($rootScope) {
        window.Promise.setScheduler(function (cb) {
            $rootScope.$evalAsync(cb);
        });
        return window.Promise;
    });
