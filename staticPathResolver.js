/**
 * A connect middleware to resolve static paths because the static server
 * assumes that all ..'s in a path are hax0rz
 */

var L = require('log');
var Url = require('url');
var QueryString = require('querystring');
var PK = require('pk');

module.exports = function() {
    return function(req, res, next) {
        if (req.method != 'GET' && req.method != 'HEAD') return next();
        L.debugi("Before", req.url);
        var url = Url.parse(req.url);
        var pathname = QueryString.unescape(url.pathname);
        var resolved = PK.resolvePath('', pathname);

        // Now put it all back
        //url.pathname = QueryString.escape(resolved);
        url.pathname = resolved;
        req.url = Url.format(url);

        // Pass through to the next layer
        L.debugi("After", req.url);
        return next();
    };
}