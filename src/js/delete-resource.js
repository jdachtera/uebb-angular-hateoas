/**
 * Directive delete-resource
 */
angular.module('uebb.hateoas')
    .directive('deleteResource', function() {
        'use strict';
        return {
            scope: {
                deleteResource: '=',
                onDelete: '&',
                onCancel: '&',
                label: '@',
                labelPrefix: '@'
            },
            restrict: 'A',
            transclude: true,
            template: '<span ng-transclude />',
            link: function(scope, element, controller) {
                element.on('click', function() {
                    scope.openPopup();
                });
            },
            controller: function($scope, deletePopup) {
                $scope.openPopup = function() {
                    deletePopup({
                        resource: $scope.deleteResource,
                        onDelete: $scope.onDelete,
                        onCancel: $scope.onCancel,
                        label: $scope.label,
                        labelPrefix: $scope.labelPrefix
                    });
                };
            }
        };
    })
    .factory('deletePopup', function($modal, $rootScope) {
        'use strict';

        return function (config) {
            var scope = $rootScope.$new();

            scope.resource = config.resource;
            scope.label = config.label || 'resource';
            scope.labelPrefix = config.labelPrefix || 'general';
            scope.onDelete = config.onDelete;
            scope.onCancel = config.onDeleted;


            var modal = $modal.open({
                templateUrl: 'uebb_hateoas_templates/delete-resource.html',
                keyboard: false,
                scope: scope,
                backdrop: 'static'
            });

            scope.delete = function() {
                scope.resource.delete()
                    .then(function() {
                        modal.close();
                        if (scope.onDelete) {
                            scope.onDelete();
                        }
                    }, function(response) {
                        scope.error = response.data;
                    });
            };

            return {
                close: function () {
                    modal.close();
                }
            };
        };
    });
