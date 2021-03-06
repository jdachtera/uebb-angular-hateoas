"use strict";

angular.module('uebb.hateoas')
    .directive('hateoasLink', function(Promise, $timeout, HateoasResource) {

        return {
            restrict: 'AEC',
            templateUrl: 'uebb_hateoas_templates/hateoas-link.html',
            transclude: true,
            replace: false,
            scope: {
                resource: '=',
                rel: '@',
                as: '@',
                params: '&',
                labelPrefix: '@',
                disableSpinner: '=?',
                update: '=?',
                onLoad: '&',
                noResetOnRouteChange: '=?',
                ignoreCache: '&'
            },

            link: function(scope, element, attributes, controller, transclude) {

                var newScope = scope.$parent.$new();
                scope.transcludeScope = newScope;
                transclude(newScope, function(clone){
                    element.find('.transclude-content').append(clone);
                });

            },
            controller: function($scope) {
                var request = null;
                var lastResource, lastRel;


                function fetch(currentValue, oldValue) {
                    Promise.resolve($scope.resource)
                        .then(function(resource) {
                            if (resource instanceof HateoasResource) {
                                if (!$scope.update && (lastResource === resource && lastRel === $scope.rel)) {
                                    return;
                                }
                                var ignoreCache = $scope.update || $scope.ignoreCache();

                                $scope.update = false;

                                lastResource = resource;
                                lastRel = $scope.rel;

                                $scope.transcludeScope.error = null;
                                $scope.transcludeScope[$scope.as || $scope.rel] = null;

                                if ($scope.promise && $scope.promise.isPending()) {
                                    $scope.promise.cancel();
                                }

                                $scope.promise = resource.getLink($scope.rel, $scope.params(), ignoreCache)
                                    .then(function(result) {
                                        var args = {};
                                        $scope.transcludeScope[$scope.as || $scope.rel] = args[$scope.as || $scope.rel] = result;
                                        $scope.onLoad(args);
                                    }, function(error) {
                                        $scope.transcludeScope.error = error;
                                    })
                                    .finally(function() {
                                        $scope.update = false;
                                    });

                            }
                        });

                }

                var off = $scope.$on('$routeChangeStart', function(next, current) {
                    var resource = $scope.transcludeScope[$scope.as || $scope.rel];
                    if (resource instanceof HateoasResource && !$scope.noResetOnRouteChange) {
                        resource.reset();
                    }
                    off();
                });

                $scope.$watch('resource', fetch);
                $scope.$watch('update', fetch);

                $scope.$watch('labelPrefix', function() {
                    $scope.labelPrefix = ((!$scope.labelPrefix || $scope.labelPrefix === '') ? 'general.item' : $scope.labelPrefix);
                });
                $scope.labelPrefix = '';
            }
        };
    });

