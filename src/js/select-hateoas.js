"use strict";

angular.module('uebb.hateoas').directive('selectHateoas', function($timeout) {
	return {
		restrict: 'EA',
		scope: {
			url: '=?',
			multiple: '=',
			label: '@',
			placeholder: '@',
			selected: '=?',
			disabled: '=',
			preselectedIds: '=?',
			onAdd: '&',
			onRemove: '&',
			rel: '@',
			resource: '=',
			srcResource: '=?',
			srcRel: '@',
			created: '=?',
			createFactory: '&',
			removed: '=?',
			limit: '=',
			where: '=',
			order: '=',
            clearButton: '='
		},
		replace: true,
		templateUrl: 'uebb_hateoas_templates/select-hateoas.html',
		link: function(scope, element, attrs, controller, transclude) {
			scope.focus = function() {
				$timeout(function() {
					element.find('input.search').focus();
				});
				$(document).on('mousedown', blurListener);
			};

			element.on('mouseenter', '.chosen-results li', function() {
				$(this).addClass('highlighted');
			});

			element.on('mouseleave', '.chosen-results li', function() {
				$(this).removeClass('highlighted');
			});

			function open() {
				if(scope.disabled) {
					return;
				}
				$timeout(function() {
					scope.active = (scope.multiple === true || scope.selected.length < scope.multiple || !scope.multiple);
					scope.showDropdown = scope.active;
					scope.focus();
				});
			}

			element.on('keydown', function(/* KeyboardEvent */ e) {
				if(e.keyCode === 13) {
					e.preventDefault();
					scope.selectWithEnter();
					$timeout(function() {
						open();
					}, 200);
				}
				else if(e.keyCode === 40) {
					e.preventDefault();
					scope.preSelectNext();
				}
				else if(e.keyCode === 38) {
					e.preventDefault();
					scope.preSelectPrev();
				}
			});

			element.on('click', '.chosen-choices, .chosen-single', function() {
				open();
			});

			function blurListener(event) {
				$timeout(function() {
					if(!$.contains(element[0], event.target)) {
						scope.showDropdown = false;
						scope.active = false;
						$(document).off('mousedown', blurListener);
					}
				});
				return true;
			}
		},
		controller: function($scope, HateoasResource, HateoasCollection, $timeout, $q) {
			$scope.add = function(item) {
				if($scope.multiple) {
					if($scope.multiple !== true && $scope.selected.length >= $scope.multiple) {
						return;
					}
					$scope.remove(item);
				}
				else {
					angular.forEach($scope.selected, function(item) {
						$scope.remove(item);
					});
				}

				$scope.selected.push(item);
				$scope.onAdd({item: item});

				if($scope.resource instanceof HateoasResource && $scope.rel && indexOf($scope.existing, item) === -1) {
					$scope.resource.setLink($scope.rel, item, !$scope.multiple);
				}
				$scope.search = '';
				$scope.showDropdown = false;
				if($scope.multiple === true || $scope.selected.length < $scope.multiple) {
					$scope.focus();
				}
				else {
					$scope.active = false;
				}
				$scope.query();
			};

			if(!$scope.selected) {
				$scope.selected = [];
			}

			if(!$scope.removed) {
				$scope.removed = [];
			}

			function indexOf(array, item) {
				for(var i = 0; i < array.length; i++) {
					if(array[i].id === item.id) {
						return i;
					}
				}
				return -1;
			}

			$scope.existing = [];
			$scope.$watch('resource', function() {
				$q.resolve($scope.resource)
					.then(function(resource) {
						if(resource instanceof HateoasResource) {

							if(!resource.hasHref($scope.rel)) {
								return;
							}

							var params;
							if($scope.multiple) {
								params = {
									limit: $scope.multiple === true ? 0 : $scope.multiple
								};
							}

							$scope.resource.getLink($scope.rel, params).then(function(result) {
								$scope.selected.length = 0;
								$scope.existing.length = 0;
								if(result instanceof HateoasCollection) {
									$scope.selected.push.apply($scope.selected, result.items);
									$scope.existing.push.apply($scope.existing, result.items);
								}
								else {
									$scope.selected.push(result);
									$scope.existing.push(result);
								}
							}, function() {
								// No Links yet
							});
						}
					});

			});

			$scope.search = '';
			$scope.active = false;
			$scope.displayCreate = false;

			$scope.remove = function(item) {

				if (item.hasHref('self')) {
					angular.forEach($scope.selected, function(selectedItem) {
						if(item.getHref('self') === selectedItem.getHref('self')) {
							$scope.selected.splice($scope.selected.indexOf(selectedItem), 1);
							$scope.onRemove({item: selectedItem});
							if($scope.resource && $scope.rel) {
								$scope.resource.removeLink($scope.rel, item, indexOf($scope.existing, item) !== -1);
							}
						}
					});
				} else {
					$scope.selected.splice($scope.selected.indexOf(item), 1);
				}

				if($scope.created) {
					$scope.created.splice($scope.created.indexOf(item), 1);
				}
				$scope.query();
			};

			$scope.isNotSelected = function(item) {
				return !$scope.isSelected(item);
			};

			$scope.isSelected = function(item) {
				for(var i = 0; i < $scope.selected.length; i++) {
					if(item.getHref('self') === $scope.selected[i].getHref('self')) {
						return true;
					}
				}
				return false;
			};

			$scope.page = 1;
			$scope.changePage = function(newPage) {
				if(newPage < 1) {
					newPage = 1;
				}
				else if(newPage > $scope.request.value().pages) {
					newPage = $scope.request.value().pages;
				}

				$scope.page = newPage;
				$scope.query();
			};

			var queryTimeout = null;
			$scope.query = function() {
				$scope.request = null;
				$scope.displayCreate = false;

				if(queryTimeout) {
					$timeout.cancel(queryTimeout);
				}

				var where = $scope.selected.map(function(item) {
					return 'id != ' + item.id;
				});

				if($scope.where) {
					where.unshift($scope.where);
				}

				var params = {
					page: $scope.page || 1,
					limit: $scope.limit || 10,
					search: $scope.search || '',
					order: $scope.order || undefined,
					where: where.join(' AND ')
				};

				queryTimeout = $timeout(function() {
					$scope.request = HateoasResource.get($scope.url, params).then(function(result) {
						angular.forEach(result.items, function(item) {
							item.selected = false;
						});

						// Select the first item of a result
						for(var i = 0; i < result.items.length; i++) {
							if($scope.isNotSelected(result.items[i])) {
								$scope.preSelectedIndex = i;
								result.items[i].selected = true;
								break;
							}
						}

						// Check if one existing element equals result exactly, else displayCreate
						if($scope.search && $scope.created) {
							var exactMatch = false;
							angular.forEach(result.items, function(item) {
								if(item === $scope.search) {
									exactMatch = true;
								}
							});
							$scope.displayCreate = !exactMatch;
						}

						return result;
					});
					$scope.selectedIndex = 0;
				}, 250);
			};

			$scope.create = function() {
				$q.resolve($scope.createFactory({search: $scope.search})).then(function(newItem) {
					$scope.created.push(newItem);
					$scope.selected.push(newItem);
					$scope.search = '';
					$scope.showDropdown = false;
					$timeout($scope.query, 100);
				});
			};

			$scope.type = function(event) {
				if(event.keyCode === 8 && $scope.search === '') {
					if($scope.selected.length) {
						$scope.remove($scope.selected[$scope.selected.length - 1]);
					}
				}
			};

			$scope.$watch('url', function() {
				if($scope.url) {
					$scope.query();
				}
			});

			$scope.$watch('srcResource', function(srcResource) {
				$q.resolve(srcResource)
					.then(function(srcResource) {
						if(srcResource instanceof HateoasResource && $scope.srcRel) {
							$scope.url = srcResource.getHref($scope.srcRel);
						}
						if(!$scope.resource && angular.isArray($scope.preselectedIds) && $scope.preselectedIds.length) {
							if(!$scope.multiple) {
								$scope.preselectedIds.length = 1;
							}
							else if(angular.isNumber($scope.multiple) && $scope.preselectedIds.length > $scope.multiple) {
								$scope.preselectedIds.length = $scope.multiple;
							}
							HateoasResource.get($scope.url, {
								limit: 0,
								where: $scope.preselectedIds.map(function(id) {
									return 'id = ' + id;
								}).join(' OR ')
							}).then(function(response) {
								$scope.selected.length = 0;
								$scope.selected.push.apply($scope.selected, response.items);
							});
						}
					});
			});

			// The current hovering object, selected with arrow keys
			$scope.preSelectedIndex = null;
			$scope.preSelectedItem = null;

			$scope.$watch('preSelectedIndex', function(newIndex, oldIndex) {
				if(angular.isUndefined(newIndex) || newIndex === null) {
					$scope.preSelectedItem = null;
				}
				else {
					if(angular.isDefined($scope.request.value().items[newIndex])) {
						if(angular.isDefined($scope.request.value().items[oldIndex])) {
							$scope.request.value().items[oldIndex].selected = false;
						}

						$scope.preSelectedItem = $scope.request.value().items[newIndex];
						$scope.preSelectedItem.selected = true;
					}
					else {
						$scope.preSelectedIndex = null;
					}
				}
			});

			$scope.preSelectNext = function() {
				if(!$scope.request || $scope.request.isPending()) {
					return;
				}

				var newIndex = $scope.preSelectedIndex + 1;
				if(newIndex >= $scope.request.value().items.length - 1) {
					newIndex = $scope.request.value().items.length - 1;
				}

				// Validate new index
				var found = false;
				for(var i = newIndex; i < $scope.request.value().items.length; i++) {
					if($scope.isNotSelected($scope.request.value().items[i])) {
						newIndex = i;
						found = true;
						break;
					}
				}

				if(!found) {
					newIndex = null;
				}

				$scope.$apply(function() {
					$scope.preSelectedIndex = newIndex;
				});
			};

			$scope.preSelectPrev = function() {
				if(!$scope.request || $scope.request.isPending()) {
					return;
				}

				var newIndex = $scope.preSelectedIndex - 1;
				if(newIndex < 0) {
					newIndex = 0;
				}

				// Validate new index
				var found = false;
				for(var i = newIndex; i >= 0; i--) {
					if($scope.isNotSelected($scope.request.value().items[i])) {
						newIndex = i;
						found = true;
						break;
					}
				}

				if(!found) {
					newIndex = null;
				}

				$scope.$apply(function() {
					$scope.preSelectedIndex = newIndex;
				});
			};

			$scope.selectWithEnter = function() {
				if(!$scope.request || $scope.request.isPending()) {
					return;
				}

				if(angular.isDefined($scope.request.value().items[$scope.preSelectedIndex])) {
					$scope.add($scope.request.value().items[$scope.preSelectedIndex]);
				}
				else {
					$scope.create();
				}
			};
		}
	};
});