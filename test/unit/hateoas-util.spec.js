'use strict';

describe('Unit: hateoasUtil', function() {
    beforeEach(module('uebb.hateoas'));

    beforeEach(inject(function(hateoasUtil) {
        this.hateoasUtil = hateoasUtil;
    }));

    describe('.flatten()', function() {
        it('should flatten a multimensional object', inject(function($http) {
            expect(this.hateoasUtil.flatten({test: {obj: 'bla'}})).toEqual({"test[obj]":"bla"});
        }));

        it('should recursively convert arrays to flattened indexes', inject(function($http) {
            expect(this.hateoasUtil.flatten({test: {obj: ['abc', 'def', {test: 'bla'}]}})).toEqual({'test[obj][0]': 'abc', 'test[obj][1]': 'def', 'test[obj][2][test]': 'bla'});
        }));
    });

    describe('.copy()', function() {
        it('should copy all properties to the target', function() {
           var source = {test: 'test', obj: {test: 'test'}},
               target = {};

           this.hateoasUtil.copy(source, target);

           expect(target).toEqual(source);
        });

        it('should create a new object if classed without second parameter', function() {
            var source = {test: 'test', obj: {test: 'test'}};

            var target = this.hateoasUtil.copy(source);

            expect(target).toEqual(source);
        });

        it('should omit dollar properties at first level', function() {
            var source = {$test: 'test', obj: {test: 'test'} };

            var target = this.hateoasUtil.copy(source);

            expect(target).toEqual({obj: {test: 'test'}});
        });
    });

    describe('.addParamsToUrl()', function() {
        it('should add the params to the url and overwrite any existing with the same name', function() {
            expect(this.hateoasUtil.addParamsToUrl('http://www.domain.com/search?q=test', {q: 'something', l: 'en'})).toEqual('http://www.domain.com/search?q=something&l=en');
        });
    });

    describe('.convertJsonToFormData()', function() {
        it('should return a FormData object', function() {
            var object = {
                name: 'Jack'
            };

            var formData = this.hateoasUtil.convertJsonToFormData(object);
            expect(formData instanceof FormData).toBe(true);
        });
    });

    describe('.normalizeUrl()', function() {
        it('should sort the query parameters of an url', function() {
            expect(this.hateoasUtil.normalizeUrl('http://domain.com/?b=a&a=b&c=d')).toEqual('http://domain.com/?a=b&b=a&c=d');
        });
    });

    var resource = {
        name: 'Test',
        tags: ['testing', 'unit'],
        _links: {
            self: {
                href: '/article/1'
            },
            category: {
                href: '/category/1'
            }
        },
        _embedded: {
            category: {
                _links: {
                    self: {
                        href: '/category/1'
                    }
                }
            },
            user: {
                _links: {
                    self: {
                        href: '/users/1'
                    }
                }
            }
        }
    };

    var expectedLinks = {
        self: {
            href: '/article/1'
        },
        category: {
            href: '/category/1'
        },
        user: {
            href: '/users/1'
        }
    };

    var expectedProperties = {
        name: 'Test',
        tags: ['testing', 'unit']
    };

    var normalizedResource = {
        name: 'Test',
        tags: ['testing', 'unit'],
        _links: {
            self: {
                href: '/article/1'
            },
            category: {
                href: '/category/1'
            },
            user: {
                href: '/users/1'
            }
        }
    };

    describe('.getLinks()', function() {
        it('should combine all links from _links and _embedded properties', function() {
            expect(this.hateoasUtil.getLinks(resource)).toEqual(expectedLinks);
        });
    });

    describe('.getProperties()', function() {
        it('should combine all links from _links and _embedded properties', function() {
            expect(this.hateoasUtil.getProperties(resource)).toEqual(expectedProperties);
        });
    });

    describe('.getNormalizedData()', function() {
        it('should normalize the hal+json data', function() {
            expect(this.hateoasUtil.getNormalizedData(resource)).toEqual(normalizedResource);
        });
    });

    describe('.expandUriTemplate()', function() {
        it('should expand the uri template', function() {
            var template = 'http://domain.com/users/{id}{?q}',
                params = {id: '123', q: 'test'},
                expectedUrl =  'http://domain.com/users/123?q=test';

            expect(this.hateoasUtil.expandUriTemplate(template, params)).toEqual(expectedUrl);
        });
    });

});