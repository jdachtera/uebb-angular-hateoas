/**
 * Directive hateoas-select-list.js
 */
angular.module('uebb.hateoas').directive('hateoasSelectList', function() {
	'use strict';

	return {
		restrict: 'EA',
		scope: {
			srcResource: '=',
			srcRel: '@',
			resource: '=',
			srcFilter: '=?',
			orderField: '@',
			orderDirection: '@',
			rel: '@',
			itemLabel: '@',
			labelPrefix: '@',
			removed: '=?',
			added: '=?',
			updateSelected: '=?',
			updateAvailable: '=?',
			disabled: '=?'
		},
		templateUrl: 'uebb_hateoas_templates/hateoasSelectList.html',
		link: function(scope, element, attrs) {
			scope.$watch('disabled', function(disabled) {
				if(disabled) {
					element.css({'pointer-events': 'none'});
				}
				else {
					element.css({'pointer-events': 'auto'});
				}
			});
		},
		controller: function($scope, debounce, HateoasResource) {
			$scope.removed = $scope.removed || [];
			$scope.added = $scope.added || [];

			$scope.itemLabel = $scope.itemLabel || 'item.name';
			$scope.labelPrefix = $scope.labelPrefix || 'general.select_list';

			$scope.indexOf = function(item, array) {
				if(!Array.isArray(array) || !(item instanceof HateoasResource)) {
					return -1;
				}

				var i;
				for(i = 0; i < array.length; i++) {
					if(array[i].getHref('self') === item.getHref('self')) {
						return i;
					}
				}

				return -1;
			};

			$scope.inArray = function(item, array) {
				return $scope.indexOf(item, array) !== -1;
			};

			$scope.add = function(item) {
				if(!$scope.inArray(item, $scope.added)) {
					$scope.added.push(item);
				}
			};

			$scope.remove = function(item) {
				if(!$scope.inArray(item, $scope.removed)) {
					$scope.removed.push(item);
				}
			};

			$scope.undoAdd = function(item) {
				$scope.added.splice($scope.indexOf(item, $scope.added), 1);
			};

			$scope.undoRemove = function(item) {
				$scope.removed.splice($scope.indexOf(item, $scope.removed), 1);
			};

			$scope.$watch('searchSelected', debounce(function() {
				$scope.updateSelected = true;
			}, 100));

			$scope.$watch('searchAvailable', debounce(function() {
				$scope.updateAvailable = true;
			}, 100));
		}
	};
});
