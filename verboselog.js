/**
 * A connect middleware to log the processing stack
 */

var Logger = require("logger");

module.exports = function(options) {
    var counter = 0;
    
    options = options || {};
    options.simpleForm = options.simpleForm || {};

    return function(req, res, next) {
        // Log the incoming request
        counter++;
        
        //Logger.warni(req);
        
        // Look at the file extension to see if we want the simple form
        var url = req.url;
        var ix = url.indexOf("?");
        debugger
        if (ix!=-1) {
            url = url.slice(0,ix);
        }        
        
        ix = url.lastIndexOf(".");
        if (ix!=-1) {
            var ext = url.slice(ix+1);
            
            if (options.simpleForm[ext]) {
                // Simple form only and we're out!
                Logger.debugi(counter, req.method, req.url);
                return next();
            }
        }
        
        Logger.hr();
        Logger.debugi(counter, "Starting", req.method, req.url, "\n", req.headers);
        Logger.infoi(counter, "Request Params", req.params);
        Logger.infoi(counter, "Request Query", req.query);
        Logger.infoi(counter, "Request Body", req.body);

        // Wrap writeHead to hook into the exit path through the layers.
        var writeHead = res.writeHead;
        // Store the original function
        (function(counter, req, res, writeHead) {
            res.writeHead = function(code, headers) {
                res.writeHead = writeHead;
                // Put the original back
                // Log the outgoing response
                Logger.warni(counter, "Ending ", req.method, req.url, code);
                if (headers) Logger.debugi(counter, "Headers\n", headers);
                //L.logStackUntil();
                
                var cookie = res.getHeader("Set-Cookie");
                if (cookie) {
                    Logger.debug("Set-Cookie:",cookie);
                } else {
                    //Logger.debug("No Set-Cookie header");
                }
                
                res.writeHead(code, headers);
                // Call the original
            };

        })(counter, req, res, writeHead);
        
        
        // We would like to know when there is data and stuff
        // req.on("data", function(data) {
        //     Logger.warni(counter, "Got",data.length,"bytes of data");
        // });
        // req.on("end", function() {
        //     Logger.warni(counter, "It ended");
        // });
        // 
        // 
        // 
        // (function(counter, req, original_on) {
        //     req.on = function(event, cb) {
        //         Logger.warni(counter," event =", event);
        //         original_on.call(req, event, cb);
        //     };
        // })(counter, req, req.on);

        // Pass through to the next layer
        return next();
    };
}