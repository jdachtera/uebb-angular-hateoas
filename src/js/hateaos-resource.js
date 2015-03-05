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
        function ($http, Promise, hateoasUtil, hateoasCache, HateoasRequestError) {
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
                        if (angular.isArray(response.data)) {
                            this.applyPatch(response.data);
                        } else {
                            // Hack self link and id from Location header
                            this.setHref('self', response.headers('Location'), true);
                            this.id = this.getHref('self').split('/').pop();
                        }
                        this.$originalData = this.getData();
                        console.log(this.$originalData);
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
    });
