var URL = require("url");
var Logger = require("logger");

module.exports = function(options) {
    
    options = options || {};
    
    if (options.expr && (typeof options.expr != "object")) {
        options.expr = [options.expr];
    }
    
    return function(req, res, next) {
        
        if (!options.expr) return next();

        var url = URL.parse(req.url);
        for(var key in options.expr) {
            var e = options.expr[key];
            
            if (e.exec(url.pathname)) {
                // It matches, so do our business
                Logger.warning("Deploying empty body parser for url "+url.pathname);
                req.body = {};
                return next();
            }
        }
        
        return next();
    }
}