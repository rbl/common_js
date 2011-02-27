var L = require("log");
var JSON = require("json");
var Tokens = require("tokens");

L.logStack();
L.warningi("huzzy",Tokens);

exports.sendJSON = function(res,obj,code)
{
  var code = code || 200;
  
  var body = JSON.stringify(obj);
  res.writeHead(code, 
  {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

exports.sendJSONError = function(res, error, description, code)
{
  L.error("Sending JSON Error",error,description);
  var result = 
  {
    error: error,
    error_description: description
  };
  
  var code = code || 400;
  exports.sendJSON(res,result,code);
}

exports.validate = function(req,res,meta,target) 
{
  L.debug("validate");
  var toCheck = meta.params;
  
  // See if they are requesting meta data
  if (req.param("meta"))
  {
    L.debug("Sending meta information");
    return exports.sendJSON(res, meta);
  }
  
  // Are there parameters needed?
  if (!toCheck)
  {
    // Nothing to do, pass it on
    L.debugi("No parameters to check, target is",target);
    
    return target(req,res);
  }
  
  // TODO: Enhance this checking so that for the early requests with redirect_uri's we can
  // send the error responses as part of the redirect rather than as JSON in return to the
  // original request. JSON is right once the API is up and running, but when getting the
  // access tokens we actually want to redirect to the URI (as long as there is one).
  // Check for the presence of each required parameter
  for (key in toCheck)
  {
    L.debug("Checking key", key);
    var keyDesc = toCheck[key];
    if (keyDesc.required)
    {
      var value = req.param(key);
      L.debugi("  it is required, value=",value);
      if (!value)
      {
        var result = {
          error: "Required parameter is missing",
          description: "The required parameter '"+key+"' is missing.",
          doc: key.description,
        }
        
        return exports.sendJSON(res, result);
      }
    }
    else
    {
      L.debugi("  - is not required");
    }
  }
  
  // We have all the right params, so do the request
  return target(req,res,meta);  
}

exports.register = function(app, name, controller, config)
{
  controller.config = config;
  var meta = controller.meta;
  
  for (key in meta)
  {
    var data = meta[key];
    
    var endpoint = "/" + name;
    if (data.endpoint)
    {
      endpoint += "/" + data.endpoint;
    }
    
    L.info("endpoint = ",endpoint);
    // TODO: Be more intelligent about which methods to register for a given endpoint
    
    if (data.required_scope)
    {
      L.info("  requires scope",data.required_scope)
      app.get(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
      app.post(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
      app.put(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
      app.delete(endpoint, Tokens.SessionToken(config.tokenStore, data.required_scope), controller[key]);
    }
    else
    {
      L.info("  No scope required")
      app.get(endpoint, controller[key]);
      app.post(endpoint, controller[key]);
      app.put(endpoint, controller[key]);
      app.delete(endpoint, controller[key]);
    }
  }
  
}