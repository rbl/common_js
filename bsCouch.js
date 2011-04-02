/**
 * A very light wrapper on couchdb calls that mostly is just smart enough to get
 * couch parameters out of global variables.
 */

var QueryString = require("querystring");
var JSON = require("json");

var WebRequest = require("webRequest");
var PK = require("pk");
var Logger = require("logger");

(function(module) {
  
  module.exports.config = {
    host: "127.0.0.1",
    port: 5984,
    db: "node",
  };

  module.exports.read = function(path, callback)
  {
    url = {host:module.exports.config.host, port:module.exports.config.port}
    url.pathname = "/"+ module.exports.config.db +"/" + path;
    WebRequest.get(url, function(err, response, content)
    {
      if (err) return callback(err);
      if (response.statusCode != 200) 
      {
        return callback(new Error("Server response code "+response.statusCode+" "+content));
      }

      var value = JSON.parse(content);    
      if (callback) callback(null, value);
    })
  }

  module.exports.valueByKey = function(design, view, key, callback)
  {
    var path = "_design" + "/" + design + "/_view/" + view;
    
    if (key)
    {
      var query = {startkey: JSON.stringify(key), endkey: JSON.stringify(key)};
      path += "?" + QueryString.encode(query);
    }
    
    url = {host:module.exports.config.host, port:module.exports.config.port}
    url.pathname = "/"+ module.exports.config.db +"/" + path;
    WebRequest.get(url, function(err, response, content)
    {
      if (err) return callback(err);
      if (response.statusCode != 200) 
      {
        return callback(new Error("Server response code "+response.statusCode+" "+content));
      }

      var response = JSON.parse(content);  
      if (!response.rows || response.rows.length == 0)
      {
        return callback(new Error("Now rows were returned by the server"));
      }
      
      var row = response.rows[0];
      if (callback) callback(null, row.value, row.id, row.key);
    })
  }
 
  function sendDocument(url, doc, callback, resolver, retry_count)
  {
    Logger.debug("Sending doc to ",url,"retry_count=",retry_count);
    WebRequest.put(url, JSON.stringify(doc), function(err, res, content)
    {
      if (err)
      {
        Logger.debug("Got error", err)
        if (retry_count > 5)
        {
          // Screw it, that's a permanent error
          if (callback)
          {
            callback(new Error("Unable to send doc after 5 attempts"));
          }
          return;
        }
        
        // Hmm, maybe we can get the current version of the doc, run it through
        // the resolver (if any) and try again?
        WebRequest.get(url, function(err, response, content)
        {
          if (content && content.length)
          {
            var existing = JSON.parse(content);
            if (resolver)
            {
              doc = resolver(existing, doc);
            }
            else
            {
              // Just copy the existing revision to the new doc and submit again
              doc._rev = existing._rev;
            }
          }
          else
          {
            // That's F-ed, call it an error
            if (callback)
            {
              callback(new Error("Failed to send document and could not get current revision."));
            }
            return;
          }
          
          // Try to submit again
          sendDocument(url, doc, callback, resolver, retry_count+1);
        });
        return;
      }
      
      // Else, that submission worked out just fine.
      // Send the id of the newly sent document to the callback
      var id = null;
      if (content && content.length)
      {
        Logger.debug("Got response",content);
        var response = JSON.parse(content);
        doc._id = response.id;
        doc._rev = response.rev;
        id = response.id;
      }
      else
      {
        Logger.debug("No response content");        
      }
      
      if (callback)
      {
        callback(null, id);
      }
    });
  }
  
  module.exports.save = function(doc, callback, resolver)
  {
    if (!doc._id)
    {
      // Create a new id for this document
      doc._id = PK.uuid();
    }
    
    url = {host:module.exports.config.host, port:module.exports.config.port}
    url.pathname = "/"+ module.exports.config.db +"/" + doc._id;

    sendDocument(url, doc, callback, resolver, 0);
  }
  
  module.exports.delete = function(id, callback)
  {
    // TODO, id could be a doc we remove the id from, but whatever. Treat it as an id for now
    url = {host:module.exports.config.host, port:module.exports.config.port}
    url.pathname = "/"+ module.exports.config.db +"/" + id;

    // Don't care much about filtering the callback right now. Do it when we care more.
    WebRequest.delete(url, callback);
  }
  
})(module);