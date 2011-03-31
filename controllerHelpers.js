/**
 * Module Dependencies
 */
var L = require("log");
var JSON = require("json");
var Tokens = require("tokens");

/**
 * Send an object encoded as json as the response data. The optional code
 * can be used to indicate non-200 responses.  The object passed in is encoded
 * using JSON.stringify and sent with a application/json Content-Type which is
 * generally the right way to send a JSON object.
 *
 * @param {HttpResponse} res - the response object passed through the middleware layers
 * @param {Object} obj - an object to be encoded as JSON
 * @param {int} code - the HTTP response code. Will default to 200 if not specified.
 * @type void
 */
exports.sendJSON = function(res,obj,code) {
    var code = code || 200;

    var body = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

/**
 * Similar to sendJSON, but more specifically sends a standard JSON error document
 * as the response.
 *
 * @param {HttpResponse} res - the response object passed through the middleware layers
 * @param {string} error - the short name for the error, generally without spaces
 * @param {string} description - a human readable description of the error
 * @param {int} code - the HTTP response code, will default to 400 if not specified
 * @type void
 */
exports.sendJSONError = function(res, error, description, code) {
    L.error("Sending JSON Error",error,description);
    var result = {
        error: error,
        error_description: description
    };

    var code = code || 400;
    exports.sendJSON(res,result,code);
}

/**
 * Validates a particalur request against the given meta object. This would generally
 * be called by a particular endpoint before the normal processing of the endpoint takes
 * place. The meta object is the same one used for recording the details of the api.
 * 
 * The most important validation performed here is to make sure that there are values
 * for all required parameters.
 *
 * @param {HttpRequest} req - the middleware request object
 * @param {HttpResponse} res - the middleware response object
 * @param {Object} meta - description of the endpoint and it's requirements
 * @param {Function(req,resp)} target - function to call if the validation passes
 * @type void
 */
exports.validate = function(req,res,meta,target) {
    L.debug("validate");
    var toCheck = meta.params;

    // See if they are requesting meta data
    if (req.param("meta")) {
        L.debug("Sending meta information");
        return exports.sendJSON(res, meta);
    }

    // Are there parameters needed?
    if (!toCheck) {
        // Nothing to do, pass it on
        L.debugi("No parameters to check, target is",target);

        return target(req,res);
    }

    // TODO: Enhance this checking so that for the early requests with redirect_uri's we can
    // send the error responses as part of the redirect rather than as JSON in return to the
    // original request. JSON is right once the API is up and running, but when getting the
    // access tokens we actually want to redirect to the URI (as long as there is one).
    // Check for the presence of each required parameter
    for (key in toCheck) {
        L.debug("Checking key", key);
        var keyDesc = toCheck[key];
        if (keyDesc.required) {
            var value = req.param(key);
            L.debugi("  it is required, value=",value);
            if (!value) {
                var result = {
                    error: "Required parameter is missing",
                    description: "The required parameter '"+key+"' is missing.",
                    doc: key.description,
                }

                return exports.sendJSON(res, result);
            }
        } else {
            L.debugi("  - is not required");
        }
    }

    // We have all the right params, so do the request
    // TODO: It might not be horrible to either wrap the target at this point in a try/catch so
    // we can format exceptions as JSON or maybe we just need to do that in a middleware error handler.
    return target(req,res,meta);  
}

/**
 * Register a provided controller module. The controller is slightly introspected
 * to find the meta object that describes all the endpoints in the controller module.
 * 
 * The passed in configuration value is set to the module so the operation of the
 * various controller bits can have some shared state.
 *
 * @param {Express.App} app - The app to which we should be adding routes
 * @param {string} name - the endpoint name 
 * @param {Object} controller - controller module with sub-names for this endpoint
 * @param {Object} config - What is known as the bsConfig in the app.js module, this 
 *                  configuration dictionary is used by all other pieces of the app
 *                  as well.
 * @type void
 */
exports.register = function(app, name, controller, config) {
    controller.config = config;
    var meta = controller.meta;

    for (key in meta) {
        var data = meta[key];

        var endpoint = "/" + name;
        if (data.endpoint) {
            endpoint += "/" + data.endpoint;
        }

        L.info("endpoint = ",endpoint);

        var methods;
        if (data.methods) {
            // Have to make sure they are lowercase
            methods = [];
            for(var ix = 0; ix<data.methods.length; ix++) {
                methods.push(data.methods[ix].toLowerCase())
            }
        } else {
            // By default, everything
            methods = ["get", "post", "put", "delete"];
        }

        if (data.required_scope) {
            L.info("  requires scope",data.required_scope)
            for(var ix = 0; ix<methods.length; ix++) {
                var method = methods[ix];
                app[method](endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
            }

            // app.get(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
            // app.post(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
            // app.put(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
            // app.delete(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
        } else {
            L.info("  No scope required")
            for(var ix = 0; ix<methods.length; ix++) {
                var method = methods[ix];
                app[method](endpoint, controller[key]);
            }
            // app.get(endpoint, controller[key]);
            // app.post(endpoint, controller[key]);
            // app.put(endpoint, controller[key]);
            // app.delete(endpoint, controller[key]);
        }
    }  
}
