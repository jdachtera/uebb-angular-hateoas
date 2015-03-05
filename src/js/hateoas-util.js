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
                        if (isEmpty) {
                            result[prop] = {};
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
