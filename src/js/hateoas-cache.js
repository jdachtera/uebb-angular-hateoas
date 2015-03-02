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
    function(hateoasUtil, $q) {
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
                            var localChanges = cachedResource.getChanges();

                            return cachedResource.setData(resource.getData())
                                .then(function() {
                                    cachedResource.applyChanges(localChanges);
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

    }
);
