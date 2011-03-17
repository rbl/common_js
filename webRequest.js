var URL = require("url");
var Http = require("http");
var Sys = require("sys");
var L = require("log");
var JSON = require("json");
var QueryString = require("querystring")

var WebRequest = function WebRequest(opts)
{
  if (!opts) throw new Error("WebRequest requires opts hash as it's only argument");
  if (!opts.url) throw new Error("WebRequest requires a url option");
  
  this.method = opts.method || "GET";
  this.asJSON = opts.asJSON;
  
  var url;
  if (typeof opts.url === 'string')
  {
    url = URL.parse(opts.url);
  }
  else
  {
    url = opts.url;
    if (!url.protocol) url.protocol = "http:";
  }
  this.url = url;
  //this.urlStr = URL.format(url);
  
  this.method = opts.method || 'GET';
  
  //Sys.puts("Created WebRequest: "+Sys.inspect(this))
}

WebRequest.prototype.start = function(body, callback)
{
  if (!this.url.pathname) this.url.pathname = '/';
  if (!this.url.port) this.url.port = 80;
  var asJSON = this.asJSON;
  
  L.debugi("WebRequest.start()",this.method,this.url.host, this.url.port, this.url.pathname)
  
  // Todo, in the future cache these. For now, make them all new
  var client = Http.createClient(this.url.port, this.url.hostname);
  
  var bodyContent = body;
  var headers = {'host': this.url.hostname};
  
  if (body)
  {
    if (asJSON)
    {
      L.debug('Writing body, encoding as JSON');    
      bodyContent = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    else
    {
      if (typeof body === "object")
      {
        L.debug("Writing body, encoding using query string");
        bodyContent = QueryString.encode(body);
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
      else
      {
        L.debug('Writing body, no additional encoding');    
        bodyContent = body;
        headers["Content-Type"] = "text/plain";
      }
    }
  }
  var request = client.request(this.method, this.url.pathname, headers);
  if (bodyContent)
  {
    request.write(bodyContent);
  }  
  var responseBuffer = "";  
  request.end();
  
  request.on('response', function(response)
  {
    // if (response.statusCode >= 300)
    // {
    //   // Failed!
    //   if (callback) return callback(new Error("Got server response "+response.statusCode), null);
    // }
    // 
    L.log('Response code is ',response.statusCode);
    response.setEncoding('utf8');
    response.on('data', function(chunk)
    {
      responseBuffer += chunk;
    });
    
    response.on('end', function()
    {
      // Hand the entire response to the callback
      L.log('Got end event');
      if (callback) 
      {
        if (responseBuffer && responseBuffer.length && asJSON)
        {
          L.logi("Response be",responseBuffer);
          return callback(null, response, JSON.parse(responseBuffer));
        }
        else
        {
          return callback(null, response, responseBuffer);
        }
      }
    })
  });
  
  client.on('error', function(error) 
  {
    if (callback)
    {
      return callback(error);
    }
    L.errori("HttpClient on 'error'",error);
  });
}

exports.get = function(url, callback)
{
  var opts = {url: url, method: "GET"};
  var req = new WebRequest(opts);
  
  return req.start(null, callback);
}


exports.delete = function(url, callback)
{
  var opts = {url: url, method: "DELETE"};
  var req = new WebRequest(opts);
  
  return req.start(null, callback);  
}

exports.put = function(url, doc, callback)
{
  var opts = {url: url, method: "PUT"};
  var req = new WebRequest(opts);
  
  return req.start(doc, callback);  
}

exports.post = function(url, doc, callback)
{
  var opts = {url: url, method: "POST"};
  var req = new WebRequest(opts);
  
  
  return req.start(doc, callback);  
}

// JSON versions

exports.getJSON = function(url, callback)
{
  var opts = {url: url, method: "GET", asJSON:true};
  var req = new WebRequest(opts);
  
  return req.start(null, callback);
}


exports.deleteJSON = function(url, callback)
{
  var opts = {url: url, method: "DELETE", asJSON:true};
  var req = new WebRequest(opts);
  
  return req.start(null, callback);  
}

exports.putJSON = function(url, doc, callback)
{
  var opts = {url: url, method: "PUT", asJSON:true};
  var req = new WebRequest(opts);
  
  return req.start(doc, callback);  
}

exports.postJSON = function(url, doc, callback)
{
  var opts = {url: url, method: "POST", asJSON:true};
  var req = new WebRequest(opts);
  
  
  return req.start(doc, callback);  
}

// Standard initializer stuff
exports.init = WebRequest;

exports.create = function(opts)
{
  return new WebRequest(opts);
}

exports.extend = function(subclass)
{
  subclass.prototype = WebRequest.prototype;
}