'use strict';

describe('hateoasCache', function() {
    function MockResource() {};

    MockResource.prototype.setData = function(data) {
        console.log('call');
        return Promise.resolve(this);
    };

    var data = {
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

    function mockHeaders(key) {}

    beforeEach(module('uebb.hateoas'));

    beforeEach(inject(function(hateoasCache) {
        this.hateoasCache = hateoasCache;
        this.hateoasCache.setDefaultCtor(MockResource);
    }));



    beforeEach(function(done) {
        this.hateoasCache.addToCache(data, mockHeaders)
            .then(function(resource) {
                console.log(resource);
                done();
            }.bind(this));
    });

    it('should save a resource in the cache', function() {
        expect(this.hateoasCache.getCached(data._links.self.href) instanceof MockResource).toBe(true);
        expect(this.hateoasCache.getCached(data._embedded.user._links.self.href) instanceof MockResource).toBe(true);
    });
})