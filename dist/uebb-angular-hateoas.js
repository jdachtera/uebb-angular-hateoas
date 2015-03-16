angular.module('uebb.hateoas', ['pascalprecht.translate']);

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
            controller: ["$scope", "deletePopup", function($scope, deletePopup) {
                $scope.openPopup = function() {
                    deletePopup({
                        resource: $scope.deleteResource,
                        onDelete: $scope.onDelete,
                        onCancel: $scope.onCancel,
                        label: $scope.label,
                        labelPrefix: $scope.labelPrefix
                    });
                };
            }]
        };
    })
    .factory('deletePopup', ["$modal", "$rootScope", function($modal, $rootScope) {
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
    }]);

'use strict';

angular.module('uebb.hateoas').filter( 'filesize', function () {
    var units = [
        'bytes',
        'KB',
        'MB',
        'GB',
        'TB',
        'PB'
    ];

    return function( bytes, precision ) {
        if ( isNaN( parseFloat( bytes )) || ! isFinite( bytes ) ) {
            return '?';
        }

        var unit = 0;

        while ( bytes >= 1024 ) {
            bytes /= 1024;
            unit ++;
        }

        return bytes.toFixed( + precision ) + ' ' + units[ unit ];
    };
});
/**
 * Factory HateoasResource
 */

angular.module('uebb.hateoas').factory('HateoasResource',
    /**
     *
     * @param {@link $http} $http
     * @param {@link Promise} Promise
     * @param {@link hateoasUtil} hateoasUtil
     * @param {@link hateoasCache} hateoasCache
     * @param {@link HateoasRequestError} HateoasRequestError
     *
     * @returns {@link HateoasResource}
     */
        ["$http", "Promise", "hateoasUtil", "hateoasCache", "HateoasRequestError", function ($http, Promise, hateoasUtil, hateoasCache, HateoasRequestError) {
        'use strict';


        /* global File */
        /* global FormData */


        /**
         * A HateoasResource Object
         * @class
         */
        function HateoasResource() {
            this.$originalData = {};
            this.$links = {};
        }

        /**
         * Asynchronously set the data of a resource
         * @public
         * @instance
         *
         * @param {{}} data - The data in hal+json format
         * @returns {Promise}
         */
        HateoasResource.prototype.setData = function (data) {
            angular.copy(hateoasUtil.getProperties(data), this);
            this.$originalData = data;
            this.$links = hateoasUtil.getLinks(data);
            return Promise.resolve(this);
        };

        /**
         * Get the current data of the resource as an object in hal+json format
         * @public
         * @instance
         *
         * @returns {{}} - The data in hal+json format
         */
        HateoasResource.prototype.getData = function () {
            var data = hateoasUtil.copy(this);

            delete(data.$links);
            delete(data.$originalData);

            data[hateoasUtil.linksProperty] = hateoasUtil.copy(this.$links);
            return data;
        };

        /**
         * Get the resources out of a link
         * @public
         * @instance
         *
         * @param {string} rel - The relation name to fetch
         * @param {{}} [params] - Additional GET params to append to the link url
         * @param {boolean} [ignoreCache=false] - Ignore the hateoas resource cache
         * @returns {Promise}
         */
        HateoasResource.prototype.getLinks = function (rel, params, ignoreCache) {
            var hrefs = this.getHrefs(rel);
            if (hrefs.length) {
                return Promise.all(hrefs.map(function (href) {
                    return HateoasResource.get(href, params, ignoreCache);
                }));
            } else {
                return Promise.reject('Link not found ' + rel);
            }
        };

        /**
         * Get the first resource out of a link
         * @public
         * @instance
         *
         * @param {string} rel - The relation name to fetch
         * @param {{}} [params] - Additional GET params to append to the link url
         * @param {boolean} [ignoreCache=false] - Ignore the hateoas resource cache
         * @returns {Promise}
         */
        HateoasResource.prototype.getLink = function (rel, params, ignoreCache) {
            var href = this.getHref(rel, params);
            if (href) {
                return HateoasResource.get(href, params, ignoreCache);
            } else {
                return Promise.reject('Link not found ' + rel);
            }
        };

        /**
         * Set a link to a resource in memory overwriting existing links of the given relation. The changes are saved after a .save() call
         * @public
         * @instance
         *
         * @param {string} rel - The relation name of the link
         * @param {HateoasResource} resource - The resource to link
         * @returns void
         */
        HateoasResource.prototype.setLink = function (rel, resource, unique) {
            this.setHref(rel, resource.getHref('self'));
        };

        /**
         * Add a link to a resource in memory. The changes are saved after a .save() call
         * @public
         * @instance
         *
         * @param {string} rel - The relation name of the link
         * @param {HateoasResource} resource - The resource to link
         */
        HateoasResource.prototype.addLink = function (rel, resource) {
            this.addHref(rel, resource.getHref('self'));
        };

        /**
         * Get the hrefs of a link
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {{}} [params] - Additional GET params to add to the resulting URL
         * @returns {array} - The array of hrefs
         */
        HateoasResource.prototype.getHrefs = function (rel, params) {
            if (params) {
                params = hateoasUtil.flatten(params);
            }

            var links = [];

            if (angular.isArray(this.$links[rel])) {
                links.push.apply(links, this.$links[rel]);
            } else if (this.$links[rel]) {
                links.push(this.$links[rel]);
            }

            return links.map(function (link) {
                return hateoasUtil.expandUriTemplate(decodeURI(link.href), params);
            });

        };

        /**
         * Get the first href of a link
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {{}} [params] - Additional GET params to add to the resulting URL
         * @returns {string} - The href
         */
        HateoasResource.prototype.getHref = function (rel, params) {
            var link = null;
            if (angular.isArray(this.$links[rel]) && this.$links[rel].length) {
                link = this.$links[rel][0];
            } else if (this.$links[rel]) {
                link = this.$links[rel];
            }
            if (link) {
                return hateoasUtil.expandUriTemplate(decodeURI(link.href), params);
            }
        };

        /**
         * Delete a resource on the server asynchronously
         * @public
         * @instance
         *
         * @returns {Promise}
         */
        HateoasResource.prototype.delete = function () {
            var url = this.getHref('self');

            return Promise.resolve(
                $http({method: 'DELETE', url: url, headers: headers, withCredentials: true})
            ).then(function (response) {
                    hateoasCache.invalidateRelated(this);
                    hateoasCache.remove(url);

                }.bind(this), defaultErrorCallback);
        };

        /**
         * Check if the given resource is linked to this resource via a certain relation
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {HateoasResource} resource - The hateoas resource
         * @returns {boolean}
         */
        HateoasResource.prototype.hasLink = function (rel, resource) {
            return this.hasHref(rel, resource.getHref('self'));
        };

        /**
         * Check if this resource is linked to a resource with the given URL via a certain relation
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {string} [url] - The linked URL
         * @returns {boolean}
         */
        HateoasResource.prototype.hasHref = function (rel, url) {
            var href = this.getHref(rel);

            if (url === undefined) {
                if (angular.isArray(href)) {
                    return href.length > 0;
                }
                return !!href;
            }

            if (!angular.isArray(href)) {
                var h = href;
                href = [];
                if (h) {
                    href.push(h);
                }
            }

            if (href.length === 0) {
                return false;
            }

            url = hateoasUtil.normalizeUrl(url);

            for (var i = 0; i < href.length; i++) {
                if (url === hateoasUtil.normalizeUrl(href[i])) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Check if this resource is linked to a given resource with no regard to The relation name
         * @public
         * @instance
         *
         * @param {HateoasResource} resource - The target resource
         * @returns {boolean}
         */
        HateoasResource.prototype.isLinkedWith = function (resource) {
            for (var rel in this.$links) {
                if (this.$links.hasOwnProperty(rel) && this.hasLink(rel, resource)) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Remove the link to a resource locally
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {HateoasResource}resource - The resource
         * @param {boolean} [force=false] - Generate a local change even if the resource was not linked
         * @returns {void}
         */
        HateoasResource.prototype.removeLink = function (rel, resource, force) {
            return this.removeHref(rel, resource.getHref('self'), force);
        };

        /**
         * Remove the link to a certain URI locally
         * @public
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {string} href - The linked URI
         * @param {boolean} [force=false] - Generate a local change even if the URI was not linked
         * @returns {void}
         */
        HateoasResource.prototype.removeHref = function (rel, href, force) {
            if (force) {
                if (angular.isArray(this.$originalData[hateoasUtil.linksProperty][rel])) {
                    if (this.$originalData[hateoasUtil.linksProperty][rel].filter(function (link) {
                            return link.href === href;
                        }).length === 0) {
                        this.$originalData[hateoasUtil.linksProperty][rel].push({href: href});
                    }
                }
                else if (this.$originalData[hateoasUtil.linksProperty][rel]) {
                    if (this.$originalData[hateoasUtil.linksProperty][rel].href !== href) {
                        this.$originalData[hateoasUtil.linksProperty][rel] = [this.$originalData[hateoasUtil.linksProperty][rel], {href: href}];
                    }
                }
                else {
                    this.$originalData[hateoasUtil.linksProperty][rel] = [
                        {href: href}
                    ];
                }
            }
            if (href === true) {
                delete(this.$links[rel]);
            }
            if (angular.isArray(this.$links[rel])) {
                angular.forEach(this.$links[rel], function (link) {
                    if (link.href === href) {
                        this.$links[rel].splice(this.$links[rel].indexOf(link), 1);
                    }
                }.bind(this));
            }
            else if (this.$links[rel]) {
                if (this.$links[rel].href === href) {
                    delete(this.$links[rel]);
                }
            }
        };

        /**
         * Set a link to an URI locally. Overwrites existing links of this rel
         * @instance
         *
         * @param {string} rel - The relation name
         * @param {string} href - The target URI
         * @returns {void}
         */
        HateoasResource.prototype.setHref = function (rel, href) {
            this.$links[rel] = {href: href};
        };

        /**
         * Add a link to an URI locally while keeping existing links.
         *
         * @param rel
         * @param href
         */
        HateoasResource.prototype.addHref = function (rel, href) {
            if (!angular.isArray(this.$links[rel])) {
                var links = [];
                if (this.$links[rel]) {
                    links.push(this.$links[rel]);
                }
                this.$links[rel] = links;
            }
            this.$links[rel].push({href: href});
        };

        /**
         * POST a new resource to the server asynchronously
         * @protected
         * @instance
         *
         * @param {string} url - The url to post the resource to
         * @returns {Promise}
         */
        HateoasResource.prototype.post = function (url) {
            var data = this.getData();
            var hasFiles = false;

            var conf = {method: 'POST', url: url, headers: angular.copy(headers), data: data, withCredentials: true};

            Object.keys(data).forEach(function (key) {
                if (data[key] instanceof File) {
                    hasFiles = true;
                }
            });

            if (hasFiles) {
                conf.data = hateoasUtil.convertJsonToFormData(data);
                conf.headers['Content-Type'] = undefined;
                conf.transformRequest = function (data) {
                    return data;
                };
            }

            return Promise.resolve($http(conf))
                .then(function (response) {
                    if (response.status === 201) {

                        if (response.headers('Content-Type') === 'application/json-patch+json' && angular.isArray(response.data)) {
                            this.applyPatch(response.data);
                        } else {
                            // Hack self link and id from Location header
                            this.setHref('self', response.headers('Location'), true);
                            this.id = this.getHref('self').split('/').pop();
                        }
                        this.$originalData = this.getData();
                    }
                    return this;

                }.bind(this), defaultErrorCallback);
        };

        /**
         * Get the local changes of the resource in JSON-Patch format
         * @public
         * @instance
         *
         * @returns {Array}
         */
        HateoasResource.prototype.getPatch = function () {
            var oldData = hateoasUtil.getNormalizedData(this.$originalData);
            var newData = this.getData();

            return hateoasUtil.getPatch(oldData, newData);
        };




        /**
         * Reset all local changes
         * @public
         * @instance
         *
         * @returns {void}
         */
        HateoasResource.prototype.reset = function () {
            var originalData = this.$originalData;
            for (var p in this) {
                if (this.hasOwnProperty(p)) {
                    delete(this[p]);
                }
            }
            this.setData(originalData);
        };

        /**
         * Apply a JSON patch to the resource
         * @public
         * @instance
         *
         * @param {array} changes - The changes in JSON-Patch format
         */
        HateoasResource.prototype.applyPatch = function (changes) {
            angular.forEach(changes, function (action) {
                var pathParts = action.path.split('/');
                pathParts.shift();
                if (pathParts[0] === hateoasUtil.linksProperty) {
                    switch (action.op) {
                        case 'add':
                            if (Array.isArray(action.value)) {
                                angular.forEach(action.value, function (link) {
                                    this.setHref(pathParts[1], link.href);
                                }.bind(this));
                            }
                            else {
                                this.setHref(pathParts[1], action.value.href, true);
                            }
                            break;
                        case 'remove':
                            if (Array.isArray(action.value)) {
                                angular.forEach(action.value, function (link) {
                                    this.removeHref(pathParts[1], link.href);
                                }.bind(this));
                            }
                            else {
                                this.removeHref(pathParts[1], action.value.href);
                            }
                            break;
                    }
                } else {
                    switch (action.op) {
                        case 'replace':
                            this[pathParts[0]] = action.value;
                            break;
                        case 'remove':
                            delete(this[pathParts[0]]);
                            break;
                    }
                }
            }.bind(this));
        };

        /**
         * Refresh the resource from the server
         * @public
         * @instance
         *
         * @returns {Promise}
         */
        HateoasResource.prototype.reload = function () {
            return HateoasResource.get(this.getHref('self'), null, true);
        };


        /**
         * Save the resource to the server if it is new or apply the local changes to the server if it exists already
         * @public
         * @instance
         *
         * @param {string} url - The url to save the resource to if it is new
         * @param {boolean} [touch=false] - Send an empty patch if there are no local changes
         * @returns {Promise}
         */
        HateoasResource.prototype.save = function (url, touch) {
            var promise;
            if (this.getHref('self')) {
                promise = this.patch(touch);
            }
            else {
                promise = this.post(url);
            }
            return promise.then(function (result) {
                hateoasCache.invalidateMatching(url);
                hateoasCache.invalidateMatching(this.getHref('self'));
                // Invalidate all links
                angular.forEach(Object.keys(this.$links), function (rel) {
                    angular.forEach(angular.isArray(this.$links[rel]) ? this.$links[rel] : [this.$links[rel]], function (link) {
                        hateoasCache.invalidateMatching(link.href);
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        };

        /**
         * Send the local changes to the server in JSON-Patch format
         * @protected
         * @instance
         *
         * @param {boolean} [touch=false] - Send an empty patch if there are no local changes
         * @returns {Promise}
         */
        HateoasResource.prototype.patch = function (touch) {
            var url = this.getHref('self'),
                patch = this.getPatch();

            if (patch.length === 0 && !touch) {
                return Promise.resolve(this);
            }

            return Promise.resolve($http({
                method: 'PATCH',
                url: url,
                headers: headers,
                data: patch,
                withCredentials: true
            }))
                .then(function (response) {
                    if (response.headers('Content-Type') === 'application/json-patch+json') {
                        this.applyPatch(response.data);
                    }
                    this.$originalData = this.getData();
                    return this;
                }.bind(this), defaultErrorCallback);
        };

        /**
         * Set the constructor for a content type
         *
         * @param {string} contentType - The content type
         * @param {Function} ctor - The constructor function
         */
        HateoasResource.setContentType = function (contentType, ctor) {
            hateoasCache.setContentType(contentType, ctor);
        };
        
        hateoasCache.setDefaultCtor(HateoasResource);

        /**
         * Request an url as a Hateoas Resource
         * @static
         *
         * @param {string} url - The URI to fetch
         * @param {{}} [params] - Additional GET params to append to the url
         * @param {boolean} [ignoreCache=false] - Ignore locally cached resources
         * @returns {Promise}
         */
        HateoasResource.get = function (url, params, ignoreCache) {
            url = hateoasUtil.addParamsToUrl(url, params);

            var cachedPromise = hateoasCache.getCachedPromise(url);
            // Return cachedPromise only if it is not rejected and only if it is pending if ignoreCache is set
            if (cachedPromise && !cachedPromise.isRejected() && !(ignoreCache && cachedPromise.isResolved())) {
                return cachedPromise;
            }

            if (!ignoreCache) {
                if (hateoasCache.hasValidCache(url)) {
                    return Promise.resolve(hateoasCache.getCached(url));
                }
            }

            var canceler = Promise.defer();

            var request = $http({
                method: 'GET',
                url: url,
                headers: headers,
                timeout: canceler.promise,
                withCredentials: true
            });

            var promise = Promise.resolve(request)
                .cancellable()
                .catch(Promise.CancellationError, function (e) {
                    canceler.resolve();
                    return Promise.reject(e);
                })
                .then(function (response) {
                    return hateoasCache.addToCache(response.data, response.headers);
                })
                .then(function (result) {
                    hateoasCache.setCachedRedirect(url, result.getHref('self'));
                    return result;
                }, defaultErrorCallback);

            hateoasCache.setCached(url, null, null, promise);

            return promise;

        };

        /**
         * Clear the local resource cache
         * @returns {void}
         */
        HateoasResource.clearCache = function () {
            hateoasCache.clear();
        };

        // TODO hard coded cache control (working?)
        var headers = {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        /**
         * Set a default header for all hateoas requests
         * @static
         *
         * @param {string} key - The header name
         * @param {string} null - The header value
         * @returns {void}
         */
        HateoasResource.setDefaultHeader = function (key, value) {
            if (value === null) {
                delete(headers[key]);
            }
            else {
                headers[key] = value;
            }
        };

        /**
         * @static
         * Set the property that contains the links. Normally _links
         * @param {string} value - The property name
         */
        HateoasResource.setlinksProperty = function (value) {
            hateoasUtil.linksProperty = value;
        };

        /**
         * Set the property that contains the embedded resources. Normally _embedded
         * @static
         *
         * @param {string} value - The property name
         */
        HateoasResource.setembeddedProperty = function (value) {
            hateoasUtil.embeddedProperty = value;

        };

        var defaultErrorCallback = function (response) {
            throw new HateoasRequestError(response);
        };

        /**
         * Set the default error callback
         * @static
         * @param {Function} cb - The error callback function
         */
        HateoasResource.setDefaultErrorCallback = function (cb) {
            defaultErrorCallback = cb;
        };

        /**
         * Invalidate all resources that have the given base url
         * @static
         * @param {string} href - The base url
         */
        HateoasResource.invalidateMatching = function (href) {
            hateoasCache.invalidateMatching(href);
        };

        return HateoasResource;
    }]);

'use strict';

/**
 * hateoasCache
 */
angular.module('uebb.hateoas').factory('hateoasCache',
    /**
     * @class hateoasCache
     *
     * @param {@link hateoasUtil} hateoasUtil
     * @param {@link $q} $q
     *
     * @returns {@link hateoasCache}
     */
    ["hateoasUtil", "$q", function(hateoasUtil, $q) {
        var cache = {};

        var contentTypeCtorMap = {};

        /**
         * Get a cache entry resource by url
         *
         * @param {string} href - The url
         * @returns {HateoasResource|null}
         */
        function getCached(href) {
            href = hateoasUtil.normalizeUrl(href);
            if (cache.hasOwnProperty(href)) {
                return cache[href].resource;
            }
            return null;
        }

        /**
         * Get a cached http header value for a url
         *
         * @param {string} href - The url
         * @param {string} name - The header name
         * @returns {string}
         */
        function getCachedHeader(href, name) {
            href = hateoasUtil.normalizeUrl(href);
            if (cache.hasOwnProperty(href)) {
                return cache[href].headers(name);
            }
            return null;
        }

        /**
         * Get the promise of a cache entry
         *
         * @param {string} href -  The url
         * @returns {$q}
         */
        function getCachedPromise(href) {
            href = hateoasUtil.normalizeUrl(href);
            if (cache.hasOwnProperty(href) && cache[href].promise instanceof  $q && !cache[href].promise.isRejected() && !cache[href].invalid) {
                return cache[href].promise;
            }
            return null;
        }

        /**
         * Get the parsed cache control header for a url
         *
         * @param {string} href - The url
         * @returns {{}}
         */
        function getCacheControl(href) {
            href = hateoasUtil.normalizeUrl(href);
            var header = getCachedHeader(href, 'Cache-Control');
            var cc = {};
            if (angular.isString(header)) {
                angular.forEach(header.split(';'), function (part) {
                    var splitted = part.split('=');
                    cc[splitted[0]] = splitted[1];
                });
            }
            return cc;
        }

        /**
         * Validate a single cache entry by url
         *
         * @param {string} href - The url
         * @returns {void}
         */
        function invalidateCache(href) {
            href = hateoasUtil.normalizeUrl(href);
            var entry = cache[href];
            if (entry) {
                entry.invalid = true;
            }
        }

        /**
         * Remove all query parameters and hash values from a url
         *
         * @param {string} url - The url
         * @returns {string}
         */
        function getBaseUrl(url) {
            try {
                return new URI(url).search("").hash("").toString();
            }
            catch (e) {
                return url;
            }
        }

        /**
         * Invalidate all cache entries matching the base url
         *
         * @param {string} href - The base url
         * @returns {void}
         */
        function invalidateMatching(href) {
            href = getBaseUrl(href);
            Object.keys(cache).forEach(function (url) {
                if (getBaseUrl(url) === href) {
                    invalidateCache(url);
                }
            });
        }


        /**
         * Checks if a valid cache entry exists for the url
         *
         * @param {string} href - The url to check
         * @returns {boolean}
         */
        function hasValidCache(href) {
            href = hateoasUtil.normalizeUrl(href);
            if (getCached(href) && !cache[href].invalid) {
                var lastFetchTime = (new Date(getCachedHeader('Date'))).getTime();
                var cacheControl = getCacheControl(href);
                var maxAge = parseInt(cacheControl['max-age'], 10);
                if (!maxAge || (Date.now() - lastFetchTime) > maxAge) {
                    return true;
                }
            }
            return false;
        }

        /**
         * Set a cache entry
         *
         * @param {string} href - The resource's url
         * @param {HateoasResource} [resource] - The resource
         * @param {Function} [headers] -  The angular $htttp headers function from the request
         * @param {$q} promise
         */
        function setCached(href, resource, headers, promise) {
            href = hateoasUtil.normalizeUrl(href);
            cache[href] = cache[href] || {};
            if (resource) {
                cache[href].resource = resource;
            }
            if (headers) {
                cache[href].headers = headers;
            }
            //if (promise) {
            cache[href].promise = promise;
            //}
            if (promise || resource) {
                cache[href].invalid = false;
            }
        }

        /**
         * Set a cache redirect from one url to another url
         *
         * @param {string} href - The source url
         * @param {string} redirect - The target url
         */
        function setCachedRedirect(href, redirect) {
            if (!href || !redirect) {
                return;
            }

            href = hateoasUtil.normalizeUrl(href);
            redirect = hateoasUtil.normalizeUrl(redirect);
            if (href !== redirect) {
                cache[href] = cache[redirect];
            }

        }

        /**
         * Wraps the original angular $http header function to return the single resource content type for embedded resources
         *
         * @param {Function} parentHeaders - The angular $http headers function from the original request
         * @returns {Function}
         */
        function embeddedHeaders(parentHeaders) {
            return function (name) {
                if (name.toLowerCase() === 'content-type') {
                    return '';
                }
                return parentHeaders(name);
            };
        }

        /**
         * Search for a constructor for a given content type
         *
         * @param contentType
         * @returns {HateoasResource}
         */
        function getCtor(contentType) {

            if (!contentTypeCtorMap[contentType]) {
                for (var pattern in contentTypeCtorMap) {
                    if (contentTypeCtorMap.hasOwnProperty(pattern)) {
                        if (contentType.match(pattern)) {
                            contentTypeCtorMap[contentType] = contentTypeCtorMap[pattern];
                        }
                    }
                }
            }

            return contentTypeCtorMap[contentType] || DefaultCtor;

        }

        /**
         * Add the data to the resource cache. Instantiates new hateoas objects for embebedded resources and updates already exisiting resources
         *
         * @param {{}} data - The data in hal+json format
         * @param {{}} headers - The original $http headers function from the request
         * @returns {$q}
         */
        function addToCache(data, headers) {
            var Ctor = getCtor(headers('Content-Type'));

            return getEmbedded(data, embeddedHeaders(headers))
                .then(function () {
                    return (new Ctor()).setData(data);
                })
                .then(function (resource) {
                    var url = resource.getHref('self');
                    if (url) {
                        var cachedResource = getCached(url);

                        if (cachedResource) {
                            setCached(url, cachedResource, headers, null);
                            var localChanges = cachedResource.getPatch();

                            return cachedResource.setData(resource.getData())
                                .then(function() {
                                    cachedResource.applyPatch(localChanges);
                                    return cachedResource;
                                });
                        }
                        else {
                            setCached(url, resource, headers, null);
                        }
                    }
                    return resource;
                });
        }

        /**
         * Get all of the embedded resources of a hal+json data object
         *
         * @param {{}} data - The data in hal+json format
         * @param {{}} headers - The angular $http headers function from the original request
         * @returns {$q}
         */
        function getEmbedded(data, headers) {
            var promises = [];
            angular.forEach(Object.keys(data[hateoasUtil.embeddedProperty] || {}), function (rel) {
                var embedded = data[hateoasUtil.embeddedProperty][rel];
                if (Array.isArray(embedded)) {
                    angular.forEach(embedded, function (data) {
                        promises.push(addToCache(data, headers));
                    });
                }
                else {
                    promises.push(addToCache(embedded, headers));
                }
            });
            return $q.all(promises);
        }

        /**
         * Remove all resources from the cache
         * @returns {void}
         */
        function clear() {
            for (var url in cache) {
                if (cache.hasOwnProperty(url)) {
                    delete(cache[url]);
                }
            }
        }

        /**
         * Remove a single cache entry by url
         * @param {string} url - The url of the entry to remove
         * @returns {void}
         */
        function remove(url) {
            delete(cache[url]);
        }

        /**
         * Set the constructor for a content type
         *
         * @param {string} contentType - The content type
         * @param {Function} ctor - The constructor function
         * @returns {void}
         */
        function setContentType(contentType, ctor) {
            contentTypeCtorMap[contentType] = ctor;
        }

        /**
         * Invalidate all resources that the given resource links to
         *
         * @param {HateoasResource} resource - The resource
         * @param {boolean} reverse - Reverse the link check
         * @returns {void}
         */
        function invalidateRelated(resource, reverse) {
            Object.keys(cache).forEach(function (url) {
                if (cache[url].resource && (reverse ? resource.isLinkedWith(cache[url].resource) : cache[url].resource.isLinkedWith(resource)) ) {
                    cache[url].invalid = true;
                }
            });
        }

        /**
         * Invalidate all related resources of all resources matching the url
         *
         * @param {string} href - The base url to match
         */
        function invalidateRelatedMatching(href) {
            href = getBaseUrl(href);
            Object.keys(cache).forEach(function (url) {
                if (getBaseUrl(url) === href) {
                    var resource = getCached(url);
                    if (resource) {
                        invalidateRelated(resource, true);
                    }
                }
            });
        }

        var DefaultCtor;

        /**
         * Set the default constructor function for hateoas resources
         *
         * @param {Function} Ctor - The constructor function
         * @returns {void}
         */
        function setDefaultCtor(Ctor) {
            DefaultCtor = Ctor;
        }

        /**
         * @class hateoasCache
         */
        return {
            addToCache: addToCache,
            getCached: getCached,
            getCachedHeader: getCachedHeader,
            getCachedPromise: getCachedPromise,
            invalidateCache: invalidateCache,
            invalidateMatching: invalidateMatching,
            invalidateRelated: invalidateRelated,
            invalidateRelatedMatching: invalidateRelatedMatching,
            hasValidCache: hasValidCache,
            setCachedRedirect: setCachedRedirect,
            setCached: setCached,
            remove: remove,
            clear: clear,
            setContentType: setContentType,
            setDefaultCtor: setDefaultCtor
        };

    }]
);

'use strict';

/**
 * HateoasRequestError
 */
angular.module('uebb.hateoas').factory('HateoasRequestError',
    /**
     * @returns {@link HateoasRequestError}
     */
    function() {

        /**
         * @param response
         * @class
         */
        function HateoasRequestError(response) {
            Error.call(this);
            if (angular.isFunction(Error.captureStackTrace)) {
                Error.captureStackTrace(this, HateoasRequestError);
            }
            this.message = 'There was an error during a hateoas request';
            this.code = response.code;
            this.data = response.data;
            this.headers = response.headers;
            this.status = response.status;
        }

        HateoasRequestError.prototype = Object.create(Error.prototype);
        HateoasRequestError.prototype.constructor = HateoasRequestError;
        HateoasRequestError.prototype.name = "HateoasRequestError";

        return HateoasRequestError;
    }
);

"use strict";

angular.module('uebb.hateoas')
    .directive('hateoasLink', ["Promise", "$timeout", "HateoasResource", function(Promise, $timeout, HateoasResource) {

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
            controller: ["$scope", function($scope) {
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
            }]
        };
    }]);


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
		controller: ["$scope", "$timeout", "HateoasResource", "Promise", function($scope, $timeout, HateoasResource, Promise) {

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

		}]
	};
});

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
		controller: ["$scope", "debounce", "HateoasResource", function($scope, debounce, HateoasResource) {
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
		}]
	};
});

'use strict';

/**
 * hateoasUtil
 */
angular.module('uebb.hateoas').factory('hateoasUtil',
    /**
     * @returns {@link hateoasUtil}
     */
    function() {
        /* global File */
        /* global FormData */

        /**
         *
         * @class
         */
        var hateoasUtil = {
            /**
             * @static
             */
            embeddedProperty: '_embedded',
            /**
             * @static
             */
            linksProperty: '_links',
            /**
             * Copy all properties from the source object to the destination object. If no destination object is specified, a new object is created and returned
             *
             * @static
             *
             * @param {{}} src - The source object
             * @param {{}} [dst={}] - The destination object
             * @returns {{}} The destination object
             */
            copy: function copy(src, dst) {
                dst = dst || {};

                var key;
                for (key in src) {
                    if (src.hasOwnProperty(key)) {
                        // shallowCopy is only ever called by $compile nodeLinkFn, which has control over src
                        // so we don't need to worry about using our custom hasOwnProperty here
                        if (key.charAt(0) !== '$' && key.charAt(1) !== '$') {
                            dst[key] = src[key];
                        }
                    }
                }

                return dst;
            },
            /**
             * Flattens a nested hash map for use in a GET query string
             *
             * @param {{}} data - The data object
             * @returns {}
             */
            flatten: function flatten(data) {
                if (!data || angular.isString(data) || angular.isNumber(data)) {
                    return data;
                }
                var result = {};

                function recurse(cur, prop) {
                    var i, l, p, isEmpty = true;

                    if (cur instanceof File || Object(cur) !== cur) {
                        result[prop] = cur;
                    }
                    else if (Array.isArray(cur)) {
                        for (i = 0, l = cur.length; i < l; i++) {
                            recurse(cur[i], prop ? prop + '[' + i + ']' : '' + i);
                        }
                        if (l === 0) {
                            result[prop] = [];
                        }
                    }
                    else {
                        for (p in cur) {
                            if (cur.hasOwnProperty(p)) {
                                isEmpty = false;
                                recurse(cur[p], prop ? prop + "[" + p + "]" : p);
                            }
                        }
                    }
                }

                recurse(data, "");
                return result;
            },
            /**
             * Add query params to a url
             *
             * @param {string} url - The url
             * @param {{}} params - The params to add
             * @returns {string} - The new url
             */
            addParamsToUrl: function addParamsToUrl(url, params) {
                if (params) {
                    params = hateoasUtil.flatten(params);
                    url = new URI(url);
                    angular.forEach(params, function (value, name) {
                        if (params.hasOwnProperty(name)) {
                            url.removeSearch(name);
                            url.addSearch(name, value);
                        }
                    });
                    url = url.toString();
                }
                return url;
            },
            expandUriTemplate: function(url, params) {
                if (params) {
                    params = hateoasUtil.flatten(params);
                    var url = URI.expand(url, function(key) {
                        var value = params[key];
                        delete(params[key]);
                        return value;
                    }).toString();
                    return this.addParamsToUrl(url);
                }
                return url;
            },
            /**
             * Creates a FormData object from a hashmap
             *
             * @param {{}} data - The parameters as a hashmap
             * @returns {FormData}
             */
            convertJsonToFormData: function convertJsonToFormData(data) {
                var formData = new FormData();
                data = hateoasUtil.flatten(data);
                console.log('data', data);
                Object.keys(data).forEach(function (key) {
                    formData.append(key, data[key]);
                });
                return formData;
            },
            /**
             * Returns the url with query params sorted
             *
             * @param {string} url- The url
             * @returns {string} - The normalized url
             */
            normalizeUrl: function normalizeUrl(url) {
                var uri = new URI(url);

                var query = URI.parseQuery(uri.query());
                var sorted = {};
                angular.forEach(Object.keys(query).sort(), function (key) {
                    if (!query[key] && query[key] !== 0 && query[key] !== false) {
                        return;
                    }
                    sorted[key] = query[key];
                });
                uri.query(URI.buildQuery(sorted));
                uri.normalize();

                return uri.toString();

            },
            /**
             * Extracts the links of a hal+json style object.
             * Combines regular links in the _links property with the self links of embedded resources
             * @param {{}} data - The source data in hal+json format
             * @returns {}
             */
            getLinks: function getLinks(data) {
                // Regular links in ._links property
                var links = angular.copy(data[hateoasUtil.linksProperty]) || {};

                function linkExists(link, links) {
                    for (var i = 0; i < links.length; i++) {
                        if (links[i].href === link.href) {
                            return true;
                        }
                    }
                    return false;
                }

                // Extract links from embedded resources
                angular.forEach(Object.keys(data[hateoasUtil.embeddedProperty] || {}), function (rel) {
                    // The regular links of this rel type
                    var orig = links[rel];

                    // embedded items of this rel type
                    var embedded = data[hateoasUtil.embeddedProperty][rel];

                    // _embedded[rel] can be an item or an array of items
                    // _links[rel] can be a link or an array of links
                    if (Array.isArray(embedded)) {

                        // Links needs to be an array if embedded is an array
                        links[rel] = [];

                        // Add the original link/s to the array
                        if (Array.isArray(orig)) {
                            angular.forEach(function(item) {
                                links[rel].push(item);
                            });

                        } else {
                            if (orig) {
                                links[rel].push(orig);
                            }
                        }

                        // Add the self links of the embedded resources to the links if they don't exist already
                        angular.forEach(embedded, function (item) {
                            if (!linkExists(item[hateoasUtil.linksProperty].self, links[rel])) {
                                links[rel].push(item[hateoasUtil.linksProperty].self);
                            }
                        });
                    }
                    else {
                        if (orig) {
                            if (Array.isArray(orig)) {
                                // Search for self link of the embedded item in the regular links property
                                // If it is not present, add it
                                if (!linkExists(embedded[hateoasUtil.linksProperty].self, orig)) {
                                    links[rel].push(embedded[hateoasUtil.linksProperty].self);
                                }
                            } else if (orig.href !== embedded[hateoasUtil.linksProperty].self.href) {
                                links[rel] = [embedded[hateoasUtil.linksProperty].self, orig];
                            }
                        }
                        else {
                            links[rel] = embedded[hateoasUtil.linksProperty].self;
                        }
                    }

                });

                return links;
            },
            /**
             * Extract the regular properties from a hal+json formatted source data object
             *
             * @param {{}} data - The hal+json style data
             * @returns {{}} - The data obejct with the regular properties
             */
            getProperties: function getProperties(data) {
                var properties = angular.copy(data);
                delete(properties[hateoasUtil.linksProperty]);
                delete(properties[hateoasUtil.embeddedProperty]);
                return properties;
            },
            /**
             * Normalizes the data object in hal+json format. Merges _links and _embedded properties
             *
             * @param {{}} data - The hal+json style data
             * @returns {{}} The normalized data
             */
            getNormalizedData: function getNormalizedData(data) {
                var normalized = hateoasUtil.getProperties(data);
                normalized[hateoasUtil.linksProperty] = hateoasUtil.getLinks(data);
                return normalized;
            },
            /**
             * Adds an additional path portion to a link if given
             * @param {{string}} link - The url
             * @param {{string}} additional - The additional path portion
             * @returns {string} - The new url
             */
            mergeLink: function mergeLink(link, additional) {
                if (additional && additional.length) {
                    var uri = new URI(link);
                    return uri.resource(uri.resource() + '/' + additional).toString();
                }
                else {
                    return link;
                }
            },

            getPatch: function(oldData, newData) {
                var oldLinks = oldData[hateoasUtil.linksProperty];
                var newLinks = newData[hateoasUtil.linksProperty];

                var arrayUnique = function (a) {
                    return a.reduce(function (p, c) {
                        if (p.indexOf(c) < 0) {
                            p.push(c);
                        }
                        return p;
                    }, []);
                };

                var props = arrayUnique([].concat(Object.keys(oldData), Object.keys(newData)));
                props.splice(props.indexOf(hateoasUtil.linksProperty), 1);

                var patch = [];

                angular.forEach(props, function (property) {
                    if (JSON.stringify(oldData[property]) !== JSON.stringify(newData[property])) {
                        patch.push({op: 'replace', path: '/' + property, value: newData[property]});
                    }
                });

                var rels = arrayUnique([].concat(Object.keys(oldData[hateoasUtil.linksProperty]), Object.keys(newData[hateoasUtil.linksProperty])));

                angular.forEach(rels, function (rel) {
                    var currentOldLinks = [], currentNewLinks = [];

                    if (angular.isArray(oldLinks[rel])) {
                        currentOldLinks = oldLinks[rel];
                    }
                    else {
                        if (oldLinks[rel]) {
                            currentOldLinks.push(oldLinks[rel]);
                        }
                    }
                    if (angular.isArray(newLinks[rel])) {
                        currentNewLinks = newLinks[rel];
                    }
                    else {
                        if (newLinks[rel]) {
                            currentNewLinks.push(newLinks[rel]);
                        }
                    }

                    var removed = [];
                    angular.forEach(currentOldLinks, function (oldLink) {
                        var isInNew = false;
                        angular.forEach(currentNewLinks, function (newLink) {
                            if (oldLink.href === newLink.href) {
                                isInNew = true;
                            }
                        });
                        if (!isInNew) {
                            removed.push(oldLink);
                        }
                    });
                    if (removed.length) {
                        patch.push({op: 'remove', path: '/' + hateoasUtil.linksProperty + '/' + rel, value: removed});
                    }

                    var added = [];

                    angular.forEach(currentNewLinks, function (newLink) {
                        var isInOld = false;
                        angular.forEach(currentOldLinks, function (oldLink) {
                            if (oldLink.href === newLink.href) {
                                isInOld = true;
                            }
                        });
                        if (!isInOld) {
                            added.push(newLink);
                        }
                    });
                    if (added.length) {
                        patch.push({op: 'add', path: '/' + hateoasUtil.linksProperty + '/' + rel, value: added});
                    }

                });

                return patch;
            }
        };

        return hateoasUtil;
    }
);

"use strict";

angular.module('uebb.hateoas')
    .factory('Promise', ["$rootScope", function($rootScope) {
        window.Promise.setScheduler(function (cb) {
            $rootScope.$evalAsync(cb);
        });
        return window.Promise;
    }]);

"use strict";

angular.module('uebb.hateoas')
    .directive('selectFile', ["$timeout", "HateoasResource", function($timeout, HateoasResource) {
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
    }]);

"use strict";

angular.module('uebb.hateoas').directive('selectHateoas', ["$timeout", function($timeout) {
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
		controller: ["$scope", "HateoasResource", "HateoasCollection", "$timeout", "Promise", function($scope, HateoasResource, HateoasCollection, $timeout, Promise) {
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
				Promise.resolve($scope.resource)
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
				Promise.resolve($scope.createFactory({search: $scope.search})).then(function(newItem) {
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
				Promise.resolve(srcResource)
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
		}]
	};
}]);