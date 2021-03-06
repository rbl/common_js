/**
 * A PocketKnife of useful little things
 */

var Logger = require('logger');
var Crypto = require("crypto");
var FS = require("fs");
var Path = require("path");

// Private array of chars to use for uuids
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Generates a universally (more or less) uid by creating a random stream
 * of characters. Should be reasonably fine most of the time.
 */
exports.uuid = function(len) {
    var len = len || 20;
    var chars = CHARS;
    var uuid = [];
    var radix = chars.length;

    for (var i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
    return uuid.join('');
};

/**
 * Resolve back references (..) and (.) in filesystem paths.
 * 
 * I think this could be replaced by Path.normalize() now ...
 */
exports.resolvePath = function(basePath, child) {
    var stack;
    if (basePath) {
        stack = basePath.split('/');
    } else {
        stack = [];
    }
    // Logger.warni("basePath=",basePath,"child=",child);
    // Logger.infoi("Stack is",stack);
    var list = child.split('/');
    if (list[0] === '') list.shift();
    //L.infoi("List is",list);
    for (var ix = 0; ix < list.length; ix++) {
        var el = list[ix];
        if (el === '.') {
            // Just skip it
        } else if (el === '..') {
            // Pop the previous element from the stack
            stack.pop();
            // And now fail to put this one on the stack
        } else {
            // Just add this to the stack
            if (el) stack.push(el);
        }
    }

    var result = stack.join('/');
    if (basePath) {
        if (basePath[0] === '/' && result[0] !== '/') {
            result = '/' + result;
        }
    } else {
        if (child[0] === '/' && result[0] !== '/') {
            result = '/' + result;
        }
    }

    return result;
};

exports.stringifyDate = function(date, reference) {
    reference = reference || new Date();

    var delta = reference - date;
    var deltaAbs = Math.abs(delta / 1000);

    var ret = "";

    // Less than a minute
    if (deltaAbs < 60) {
        return "just now";
    }

    if (deltaAbs < 3600) {
        // One minute to 1 hour
        var minutes = Math.floor(deltaAbs / 60);
        ret += minutes;
        ret += " minute";
        if (minutes > 1) {
            ret += "s";
        }
    } else if (deltaAbs < (24 * 3600)) {
        // 1 hour to 24 hours
        var hours = Math.floor(deltaAbs / 3600);
        ret += hours;

        ret += " hour";
        if (hours > 1) {
            ret += "s";
        }
    } else if (deltaAbs < (30 * 24 * 3600)) {
        // 1 day to 1 month
        var days = Math.floor(deltaAbs / (24 * 3600));
        ret += "over ";
        ret += days;
        ret += " day";
        if (days > 1) {
            ret += "s";
        }
    } else {
        var months = Math.floor(deltaAbs / (30 * 24 * 3600));
        ret += "over ";
        ret += months;
        ret += " month";
        if (months > 1) {
            ret += "s";
        }
    }

    if (delta > 0) {
        ret += " ago";
    } else {
        ret += " in the future";
    }

    return ret;
};

/**
  Turns a date object into a standardized string of the form
  YYYY-MM-DDThh:mm:ss.sTZD
*/
exports.isoFromDate = function(d) {
    function pad(n) {
        return n < 10 ? '0' + n: n;
    }
    function pad100(n) {
        return n < 100 ? '0' + pad(n) : n;
    }

    return d.getUTCFullYear() + '-'
    + pad(d.getUTCMonth() + 1) + '-'
    + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + ':'
    + pad(d.getUTCMinutes()) + ':'
    + pad(d.getUTCSeconds()) + '.'
    + pad(d.getUTCMilliseconds()) + '-0000';
};

/**
  Given a particular salt and password, return the hashed version.
  Standardized this here so it is usable for both checking and inserting password hashes.
*/
exports.hashPassword = function(password, salt) {
    var hasher = Crypto.createHash("sha1");
    hasher.update(salt);
    hasher.update(password);

    return hasher.digest("base64");
};

/**
  Do a deep copy on an object. Works for pretty much everything, including
  arrays. If the object is complex and does lots of stuff in it's constructor
  where state must be modified later or something then a copy might not make
  sense, but that's not this routine's fault :P
*/
exports.deepCopy = function(src) {
    if (typeof(src) != "object" || src == null) return src;
    var newInstance = src.constructor();
    for (var i in src) {
        newInstance[i] = exports.deepCopy(src[i]);
    }
    return newInstance;
};

/**
 * Reads a UInt32 from a buffer. For speed it presumes you have already checked
 * to ensure there are 4 bytes of data remaining in the buffer at the given offset.
 * The bytes are read in network byte order - MSB first.
 *
 * @param {Buffer} buffer - The buffer to read from
 * @param {int} off - An offset to begin reading 4 bytes of data
 * @returns the value of the uint32
 * @type uint32
 */
exports.readUInt32 = function(buffer, off) {
    if (!off) off = 0;
    var out = buffer[off];
    out = (out << 8) + buffer[off + 1];
    out = (out << 8) + buffer[off + 2];
    out = (out << 8) + buffer[off + 3];
    return out;
};

/**
 * Writes a uint32 to the given buffer. Assumes that there are 4 bytes of space
 * available in that buffer. Value is written in network byte order, MSB first.
 *
 * @param {Buffer} buffer - The buffer to write to
 * @param {int} off - An offset to begin writing 4 bytes of data
 * @param {uint32} value - The value to write
 * @type void
 */
exports.writeUInt32 = function(value, buffer, off) {
    if (!off) off = 0;

    buffer[off] = (value >> 24) & 0x00ff;
    buffer[off + 1] = (value >> 16) & 0x00ff;
    buffer[off + 2] = (value >> 8) & 0x00ff;
    buffer[off + 3] = (value) & 0x00ff;
};

/**
 * Get the "length of a hash". In reality this counts the objects owned
 * directly by the given object, no matter what sort of object it is. It lets
 * you do things like
 * 
 *     var x = {a:1, b:2}
 *     PK.objLength(x) => 2
 *
 * @param {Object} obj - An object with some keys
 * @returns The count of the keys attached to the object
 * @type int
 */
exports.objLength = function(obj) {
    var size = 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/**
 *  Gets a list of all the keys in a given object. Hopefully handy
 *  for debugging and figuring out the state of an object. Leaves
 *  out method names
 */
exports.propertyNames = function(obj) {
    var keys = [];
    for (var key in obj) {
        if (typeof(obj[key]) != "function")
        keys.push(key);
    }

    keys.sort();
    return keys;
};

/**
 *  Returns a list of all the keys and values in the object. Leaves off
 *  methods
 */
exports.propertyNamesAndValues = function(obj) {
    var keysAndValues = "";
    var keylist = this.propertyNames(obj);

    for (var i = 0; i < keylist.length; i++) {
        var key = keylist[i];
        keysAndValues += "\n\t" + key + ": " + obj[key];
    }

    keysAndValues += "\n";

    return keysAndValues;
};

/**
 *  Returns a sorted list of method names available for obj
 */
exports.methodNames = function(obj)
{
    var methods = [];
    for (var key in obj) {        
        if ("function" === typeof(obj[key])) methods.push(key);
    }

    methods.sort();

    var methodNames = "";
    for (var i = 0; i < methods.length; i++) {
        methodNames += "\n\t" + methods[i];
    }

    methodNames += "\n";

    return methodNames;
};


///////////////////////////////////////////////////////////////////////////////
/**
 * Removes an entire directory tree at the given path.
 *
 * @param {String} path - to a directory to remove
 * @param {function(err)} next - function to call when finished
 * @type void
 */
exports.rmTree = function(path, next) {
    //Logger.debug("rmTree in ",path);
    
    FS.readdir(path, function(err, files) {
        if (Logger.logErrorObj("Couldn't read directory", err)) {
            return next(err);
        }
        if (!files) {
            return next();
        }

        var pendingRemovals = 0;
        function removalFinished(err) {
            if (Logger.logErrorObj("Removal failed", err)) {
                pendingRemovals = -1;
                return next(err);
            }
            
            pendingRemovals -= 1;
            if (pendingRemovals===0) {
                // Totally done, can now nuke the original path
                FS.rmdir(path, function(err) {
                    Logger.logErrorObj("rmdir failed", err);
                    next(err);
                });
            }
        }
        
        pendingRemovals = files.length;
        for(var i=0; i<files.length; i++) {
            var file = files[i];
            var fpath = Path.join(path, file);
            (function(fpath) {
                FS.lstat(fpath, function(err, stats) {
                    if (stats && stats.isDirectory()) {
                        Logger.debug("stat of ",fpath," DIRECTORY");
                        // Have to recurse into it
                        exports.rmTree(fpath, removalFinished);
                    } else {
                        // Just unlink it directly
                        Logger.debug("stat of ",fpath," file");
                        FS.unlink(fpath, removalFinished);
                    }
                });
            })(fpath);
        }
        
        // Handle special case where directory is already empty
        if (pendingRemovals===0) {
            pendingRemovals = 1;
            removalFinished();
        }
        
    });
};

