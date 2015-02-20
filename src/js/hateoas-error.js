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
