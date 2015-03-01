'use strict';

angular.module('uebb.hateoas').factory('HateoasCollection',
/**
 * @param {@link HateoasResource} HateoasResource
 * @returns {@link HateoasCollection}
 */
function(HateoasResource) {

	/**
	 *
	 * @class
     * @extends HateoasResource
	 */
    function HateoasCollection() {
        HateoasResource.apply(this, arguments);
        this.items = [];
    }

    HateoasCollection.prototype = Object.create(HateoasResource.prototype);

    /**
     * Get all items of the collection asynchronously
     * @returns {Promise}
     */
    HateoasCollection.prototype.getItems = function () {
        return this.getLink('items')
            .then(function (items) {
                this.items = items;
                return this.items;
            }.bind(this));
    };

    HateoasCollection.prototype.setLink

    /**
     * Set the data
     *
     * @param {{}} data - The data in hal+json format
     * @returns {Promise}
     */
    HateoasCollection.prototype.setData = function (data) {
        return HateoasResource.prototype.setData.call(this, data)
            .then(function () {
                return this.getItems();
            }.bind(this))
            .then(function (items) {
                return this;
            }.bind(this));
    };

    /**
     * A collection only has links, no regular properties
     * @returns {{}}
     */
    HateoasCollection.prototype.getData = function () {
        var data = HateoasResource.prototype.getData.call(this);
        delete(data.items);
        return data;
    };


    /**
     * Override the save function to disallow save
     *
     * @type {Function}
     */
    HateoasCollection.prototype.post = HateoasCollection.prototype.patch = function () {
        throw 'Collections cannot be saved';
    };


    /**
     * Fetch another page of the collection
     *
     * @param {integer} page - The page to fetch
     * @param {integer} limit - The maximum items per page
     * @returns {Promise}
     */
    HateoasCollection.prototype.fetchPage = function (page, limit) {
        var url = new URI(this.getHref('self'))
            .removeSearch('page')
            .removeSearch('limit')
            .addSearch('page', page)
            .addSearch('limit', limit === undefined ? this.limit : limit)
            .build();

        return HateoasResource.get(url);
    };

    /**
     * Fetch the next page
     *
     * @returns {Promise}
     */
    HateoasCollection.prototype.nextPage = function () {
        return HateoasResource.get(this.getHref('next'));
    };

    /**
     * Fetch the previous page
     *
     * @returns {Promise}
     */
    HateoasCollection.prototype.previousPage = function () {
        return HateoasResource.get(this.getHref('previous') || this.getHref('prev'));
    };

    /**
     * Query the collection
     *
     * @param {{}} params - The query params
     * @returns {Promise}
     */
    HateoasCollection.prototype.query = function (params) {
        params = params || {};
        params.page = params.page || 1;
        return HateoasResource.get(this.getHref('self'), params);
    };

    return HateoasCollection;

});
