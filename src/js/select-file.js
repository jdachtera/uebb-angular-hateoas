"use strict";

angular.module('uebb.hateoas')
    .directive('selectFile', function($timeout, HateoasResource) {
        return {
            templateUrl: 'uebb_hateoas_templates/select-file.html',
            restrict: 'E',
            scope: {
                linkRel: '@',
                linkResource: '=?',
                resource: '&',
                uploadProperty: '=?',
                multiple: '=?',
                files: '=?',
                mimeTypes: '=?',
                upload: '=?',
                max: '=?',
                maxFilesize: '@',
                errors: '=?',
                updateExisting: '=?',
                errorPrefix: '@',
                label: '@'
            },
            link: function(scope, element) {
                scope.data = {updateExisting: false};
                scope.uploadProperty = scope.uploadProperty || 'upload';
                scope.files = scope.files || [];
                    element.find('input[type=file]').on('change', function(changeEvent) {
                    $timeout(function() {
                        var resource;
                        for(var i = 0; i < changeEvent.target.files.length && (!scope.max || i < scope.max); i++) {
                            /**
                             * @type {HateoasResource}
                             */
                            resource = scope.resource() || new HateoasResource();
                            resource[scope.uploadProperty || 'upload'] = changeEvent.target.files.item(i);
                            if(scope.linkResource && scope.linkRel && !resource.hasLink(scope.linkRel, scope.linkResource)) {
                                resource.setLink(scope.linkRel, scope.linkResource);
                            }
                            scope.files.push(resource);
                        }
                        changeEvent.target.value = '';
                    });
                });

                scope.$watch('label', function(label) {
                    if (!label || label === '') {
                        scope.label = 'general.choose_file';
                    }
                });

                scope.$watch('files.length', function(length) {
                    element.find('input[type=file]').prop('disabled',
                        scope.multiple ? (scope.max && length >= scope.max) : length >= 1
                    );
                });

                scope.$watch('multiple', function(multiple) {
                    element.find('input[type=file]').prop('multiple', !!multiple);
                    if (multiple && scope.label === 'general.choose_file') {
                        scope.label = 'general.choose_files';
                    }
                    if (!multiple && scope.label === 'general.choose_files') {
                        scope.label = 'general.choose_file';
                    }
                });

                scope.$watch('updateExisting', function(updateExisting) {
                    scope.data.updateExisting = updateExisting;
                });

                scope.$watch('data.updateExisting', function(updateExisting) {
                    scope.updateExisting = updateExisting;
                });

                scope.getFileErrors = function(file) {
                    var result = null;
                    if(angular.isArray(scope.errors)) {
                        angular.forEach(scope.errors, function(item) {
                            if(item.item === file) {
                                result = item.errors;
                            }
                        });
                    }
                    return result;
                };
            }
        };
    });
