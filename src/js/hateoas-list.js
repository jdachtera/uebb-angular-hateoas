/**
 * Directive hateoas-list
 */
angular.module('uebb.hateoas').directive('hateoasList', function() {
	"use strict";

	return {
		restrict: 'EA',
		templateUrl: 'uebb_hateoas_templates/hateoas-list.html',
		transclude: true,
		replace: false,
		scope: {
			resource: '=?',
			rel: '@',
			as: '@',
			resourceAs: '@',
			limit: '@',
			bare: '=?',
			order: '@',
			where: '@',
			page: '@',
			search: '@',
			update: '=?',
			orderFields: '=?',
			orderField: '@',
			orderDirection: '@',
			labelPrefix: '@',
			disableSpinner: '=?',
			disableMessages: '=?',
			disablePagination: '=?',
			if: '=',
			onLoad: '&',
            ignoreCache: '&'
		},
		link: function(scope, element, attributes, controller, transclude) {
			scope.transcludeScope = scope.$parent.$new();
			transclude(scope.transcludeScope, function(clone) {

				if(scope.bare) {
					element.find('.transclude-bare').replaceWith(clone);
					clone.find('.pagination').replaceWith(element.find('.hateoas-pagination'));
					clone.find('.orderFields').replaceWith(element.find('.orderFields'));
					clone.find('.response').replaceWith(element.find('.response'));
					element.find('.hateoas-list').remove();

				}
				else {
					element.find('.transclude-content').append(clone);
				}

			});
		},
		controller: function($scope, $timeout, HateoasResource, Promise) {

			$scope.page = $scope.page || 1;

            var lastParamsString;

			function fetch() {

				if($scope.if !== false) {
					$scope.transcludeScope.error = null;
					var invalidate = $scope.update || !!$scope.ignoreCache();
                    var update = $scope.update;

                    $scope.update = false;

					Promise.resolve($scope.resource)
						.then(function(resource) {
							if(resource instanceof HateoasResource) {

								var order = [];
								if($scope.order && $scope.order !== '') {
									order.push($scope.order);
								}
								if($scope.orderField && $scope.orderDirection) {
									order.push($scope.orderField + ' ' + $scope.orderDirection);
								}

                                $scope.limit = parseInt($scope.limit, 10);
                                if (isNaN($scope.limit)) {
									$scope.limit = 10;
                                }

                                $scope.page = parseInt($scope.page, 10);
                                if (isNaN( $scope.page)) {
									$scope.page = 1;
                                }

                                var params = {
                                    search: $scope.search || '',
                                    limit:  $scope.limit,
                                    order: order.join(','),
                                    where: $scope.where || '',
                                    page:  $scope.page
                                };

                                // Make sure we don't trigger the same request many times because of the multiple watchers
                                var newParamsString = JSON.stringify(params);
                                if (newParamsString === lastParamsString && !update && $scope.promise && $scope.promise.isPending()) {
                                    return;
                                }
                                lastParamsString = newParamsString;

                                if($scope.promise && $scope.promise.isPending()) {
                                    $scope.promise.cancel();
                                }

                                $scope.transcludeScope.error = null;

                                var args = {}

                                $scope.promise = resource.getLink($scope.rel, params, invalidate)
                                    .then(function(result) {
                                        if($scope.resourceAs) {
                                            $scope.transcludeScope[$scope.resourceAs] = args[$scope.resourceAs] = result;
                                        }
                                        $scope.pages = result.pages;
                                        $scope.page = '' + result.page;
                                        $scope.result = result;
                                        return result.getLinks('items');
                                    })
                                    .then(function(items) {
                                        $scope.transcludeScope[$scope.as || $scope.rel] = args[$scope.as || $scope.rel] = items;
                                        $scope.onLoad(args);
                                    }, function(error) {
                                        $scope.transcludeScope.error = error;
                                    });
							}
						});
				}
			}

            $scope.$watch('if', fetch);
            $scope.$watch('page', fetch);
            $scope.$watch('limit', fetch);
            $scope.$watch('order', fetch);
            $scope.$watch('orderField', fetch);
            $scope.$watch('orderDirection', fetch);
            $scope.$watch('resource', fetch);

            $scope.$watch('labelPrefix', function() {
                $scope.labelPrefix = ((!$scope.labelPrefix || $scope.labelPrefix === '') ? 'general.list' : $scope.labelPrefix);
            });
            $scope.labelPrefix = '';

            $scope.setOrder = function(field, direction) {
                $scope.orderField = field;
                $scope.orderDirection = direction;
            };

            $scope.$watch('orderFields', function() {
                if($scope.orderFields && $scope.orderFields.length) {
                    if($scope.orderDirection !== 'DESC') {
                        $scope.orderDirection = 'ASC';
                    }
                    $scope.orderField = $scope.orderFields.indexOf($scope.orderField) === -1 ? $scope.orderFields[0] : $scope.orderField;
                }
            });

            $scope.$watch('update', function(update) {
                if(update) {
                    fetch();
                }
            });

		}
	};
});
