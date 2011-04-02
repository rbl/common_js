/**
 * A connect middleware to log the processing stack
 */

var Logger = require("logger");

module.exports = function() {
    var counter = 0;

    return function(req, res, next) {
        // Log the incoming request
        counter++;
        Logger.warni(counter, req.method, req.url, req.headers);

        // Wrap writeHead to hook into the exit path through the layers.
        var writeHead = res.writeHead;
        // Store the original function
        (function(counter, req, res, writeHead) {
            res.writeHead = function(code, headers) {
                res.writeHead = writeHead;
                // Put the original back
                // Log the outgoing response
                Logger.warn(counter, req.method, req.url);
                Logger.info(counter, code, JSON.stringify(headers));
                //L.logStackUntil();
                res.writeHead(code, headers);
                // Call the original
            };

        })(counter, req, res, writeHead);

        // Pass through to the next layer
        return next();
    };
}