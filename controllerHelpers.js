/**
 * Module Dependencies
 */
var Logger = require("logger");
var JSON = require("json");

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
exports.sendJSONError = function(req, res, error, description, code) {
    Logger.error("Sending JSON Error",error,description);
    var result = {
        error: error,
        errorDescription: description
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
exports.validate = function(req,res,next,meta,target) {
    Logger.debug("validate");
    function goodParam(param, name) {
        if (!param) {
            Logger.error("Probably FATAL: in controllerHelpers.validate the param",name,"is missing :(");
            Logger.logStack();
            if (res) {
                res.writeHead(500,{});
                res.end();
            }
            return false;
        }
        return true;
    };
    
    if (!goodParam(req,"req") || !goodParam(res,"res") || !goodParam(next,"next") ||
        !goodParam(meta,"meta") || !goodParam(target,"target")) return;
    var toCheck = meta.params;

    var errorHandler = meta.errorHandler;
    if ((typeof errorHandler) === "string") {
        if (errorHandler === "json") {
            errorHandler = exports.sendJSONError;
        }
    }
    if (!errorHandler) {
        errorHandler = exports.sendJSONError;
    }

    // See if they are requesting meta data
    if (req.param("meta")) {
        Logger.debug("Sending meta information");
        return exports.sendJSON(res, meta);
    }

    // Are there parameters needed?
    if (!toCheck) {
        // Nothing to do, pass it on
        Logger.debugi("No parameters to check, target is",target);

        return target(req,res,next,meta);
    }

    // TODO: Enhance this checking so that for the early requests with redirect_uri's we can
    // send the error responses as part of the redirect rather than as JSON in return to the
    // original request. JSON is right once the API is up and running, but when getting the
    // access tokens we actually want to redirect to the URI (as long as there is one).
    // Check for the presence of each required parameter
    for (key in toCheck) {
        Logger.debug("Checking key", key);
        var value = req.param(key);

        var keyDesc = toCheck[key];
        if (keyDesc.required) {
            Logger.debugi("  it is required, value=",value);
            if (!value) {
                var error = "Required parameter is missing";
                var description = "The required parameter '" + key + "' is missing.";
                return errorHandler(req, res, error, description, 400);
            }
        } else {
            Logger.debugi("  - is not required");
        }
        
        if (value) {
            // If it is there, it has to match the other validation
            if (keyDesc.minLength) {
                if (value.length < keyDesc.minLength) {
                    var error = "Parameter to short";
                    var description = "The parameter '" + key + "' must be at least "+keyDesc.minLength+" characters long.";
                    return errorHandler(req, res, error, description, 400);
                }
            }
            
            if (keyDesc.validation) {
                if (!keyDesc.validation.test(value)) {
                    var error = "Bad format";
                    var description = "The parameter '" + key + "' was not in the required format.";
                    return errorHandler(req, res, error, description, 400);                    
                }
            }
        }
    }

    // We have all the right params, so do the request
    // TODO: It might not be horrible to either wrap the target at this point in a try/catch so
    // we can format exceptions as JSON or maybe we just need to do that in a middleware error handler.
    return target(req,res,next,meta);  
}


function addFilters(stack, data, list) {
    if (typeof list === "function") {
        // Call it directly
        var mw = list(data);
        if (mw) stack.push(mw);
    } else {
        // Presumably it's an array then
        for(var ix = 0; ix<list.length; ix++) {
            var mw = list[ix](data);
            if (mw) stack.push(mw);
        }
    }
}


/**
 * Register a provided controller module. The controller is slightly introspected
 * to find the meta object that describes all the endpoints in the controller module.
 *
 * @param {Express.App} app - The app to which we should be adding routes
 * @param {string} name - the endpoint name 
 * @param {Object} controller - controller module with sub-names for this endpoint
 * @type void
 */
exports.register = function(app, name, controller, options) {
    var meta = controller.meta;
    if (!options) options = {};
    
    for (key in meta) {
        var data = meta[key];

        // Logger.info("name='"+name+"' data.endpoint='"+data.endpoint+"' name.length="+name.length);                
        var endpoint = (name.length > 0) ? ("/" + name) : "";
        if (data.exactEndpoint) {
            endpoint = data.exactEndpoint;
        } else if (data.endpoint) {
            endpoint += "/" + data.endpoint;
        }
        
        // Safety
        if (endpoint.length===0) endpoint = "/";

        Logger.info("endpoint = ",endpoint);

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
        
        // The suffix is added unless configured not to
        var stack = [endpoint];
        if (data.preSessionHandler) stack.push(data.preSessionHandler);
        if (options.beforeFilter) addFilters(stack, data, options.beforeFilter);
        
        if (data.middleware) {
            // If an explict set of middleware is defined, use it. This can be
            // either an array or a single function
            if ((typeof data.middleware) === "object") {
                // Logger.debug("Adding middleware from array");
                for(var ix=0; ix<data.middleware.length; ix++) {
                    Logger.debugi("typeof ",data.middleware[ix])
                    stack.push(data.middleware[ix]);
                }
            } else {
                // Logger.debug("Adding single middleware");
                stack.push(data.middleware);
            }
        } else {
            // Otherwise use convention to find the middleware
            stack.push(controller[key]);            
        }
        
        if (options.afterFilter) addFilters(stack, data, options.afterFilter);

        Logger.debugi("Stack=",stack);
        for(var ix = 0; ix<methods.length; ix++) {
            var method = methods[ix];
            app[method].apply(app, stack);
        }
    }  
}

exports.handleMeta = function(meta) {
    
    return function(req, res, next) {
        
        if (!meta) return next();
        
        if (req.param("meta")) {
            Logger.debug("Sending meta information");
            return res.send(meta);
        }
        
        // Let it go
        next();
    }
}

exports.checkMetaParams = function(meta) {
    
    return function(req, res, next) {
        
        // Bail if there is nothing to check
        if (!meta) {
            return next();
        }

        // Are there parameters needed?
        var toCheck = meta.params;
        if (!toCheck) {
            // Nothing to do, pass it on
            Logger.debugi("No parameters to check");
            return next();
        }
        
        Logger.debugi("Checking params ",toCheck);

        // TODO: Enhance this checking so that for the early requests with redirect_uri's we can
        // send the error responses as part of the redirect rather than as JSON in return to the
        // original request. JSON is right once the API is up and running, but when getting the
        // access tokens we actually want to redirect to the URI (as long as there is one).
        // Check for the presence of each required parameter
        for (key in toCheck) {
            Logger.debug("Checking key", key);
            var value = req.param(key);

            var keyDesc = toCheck[key];
            if (keyDesc.required) {
                Logger.debugi("  it is required, value=",value);
                if (!value) {
                    return res.send({
                          error: "Required parameter is missing"
                        , description: "The required parameter '" + key + "' is missing."
                    }, 400);
                }
            } else {
                Logger.debugi("  - is not required");
            }

            if (value) {
                // If it is there, it has to match the other validation
                if (keyDesc.minLength) {
                    if (value.length < keyDesc.minLength) {
                        return res.send({
                              error: "Parameter to short"
                            , description: "The parameter '" + key + "' must be at least "+keyDesc.minLength+" characters long."                            
                        }, 400);
                    }
                }

                if (keyDesc.validation) {
                    if (!keyDesc.validation.test(value)) {
                        return res.send({
                              error: "Bad format"
                            , description: "The parameter '" + key + "' was not in the required format."
                        }, 400);
                    }
                }
            }
        }

        // We have all the right params, so do the request
        
        next();
    };
}

exports.metaAndParams = function(meta) {
    
    var handler = exports.handleMeta(meta);
    var checker = exports.checkMetaParams(meta);
    
    return function(req, res, next) {
        
        
        handler(req, res, function(err) {
            if (err) return next(err);
            
            checker(req, res, next);
        });
    }
}
