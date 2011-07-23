/**
 * A connect middleware to log the processing stack
 */

var Logger = require("logger");

module.exports = function() {
    var counter = 0;

    return function(req, res, next) {
        // Log the incoming request
        counter++;
        Logger.hr();
        Logger.debugi(counter, "Starting", req.method, req.url, "\n", req.headers);
        Logger.infoi(counter, "Body", req.body);

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