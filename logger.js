/**
 * Module Dependencies
 */
var Sys = require('sys');

/**
 * Constants
 */
var LEVEL_SPACE = "     ";
var MAX_LEVEL_LENGTH = LEVEL_SPACE.length;
var CONTINUATION_SPACE = "             ";
var NEWLINE_HEADER = "\n" + CONTINUATION_SPACE + LEVEL_SPACE + " | ";
var HR = "-----------------------------------------------------------------------";

var CSI = '\x1B[';

var COLOR_REST = CSI + "m";

exports.DEBUG = "DEBUG";
exports.INFO = "INFO";
exports.WARN = "WARN";
exports.ERROR = "ERROR";

// Refer to http://en.wikipedia.org/wiki/ANSI_escape_code
// 30-37 for foreground color, 39 = default
// 40-47 for background color, 49 = default
// 0:Black 1:Red 2:Green 3:Yellow 4:Blue 5:Magenta 6:Cyan 7:White
//
// 1 for bright (as opposed to dull)
// 22 for normal intensity
// 3 italic (23 off) = no work
// 4 underline (24 off) = Mac OK
// 5 blink (25 off) = no work
//
// The following don't work in Mac Terminal
// 51	Framed	
// 52	Encircled	
// 54 Not framed or encircled 
// 53 Overlined 
// 55	Not overlined

var COLORS = {};
COLORS[exports.DEBUG] = "32;22";
COLORS[exports.INFO] = "39;22";
COLORS[exports.WARN] = "34;1";
COLORS[exports.ERROR] = "31;1";

var DO_COLOR = true;

///////////////////////////////////////////////////////////////////////////////
/**
 * The main logging function. All the other stuff really just sets values that
 * get passed into this funciton if possible.
 *
 * @param {Object} options - set of key value options
 *                  options.level - the level of the message, exports.DEBUG, exports.INFO, exports.WARN, or exports.ERROR
 *                  options.continuation - if set to true, this line is considered a continuation
 *                                         of the previous log message. In general this means it won't get it's
 *                                         own unique timestamp.
 *                  options.inspect - if true the Sys.inpect method will be used instead of the to_string method for each argument
 * @param {Object} other arguments - All other arguments are output to the log stream either 
 *                                   using their to_string method or by calling Sys.inspect on them
 * @type void
 */
function logLine(options) {
    var level = options.level || exports.INFO;
  
    var line = "";
    if (options.continuation) {
        line += CONTINUATION_SPACE;
    } else {
        var d = new Date();
        line += d.getHours() + ":" + d.getMinutes() +":"+ d.getSeconds() +":"+ d.getMilliseconds() + " ";
        while(line.length < CONTINUATION_SPACE.length) line += " "; 
    }
  
    if (DO_COLOR) line += CSI + COLORS[level] + 'm';
    line += level.slice(0,MAX_LEVEL_LENGTH);
    //if (DO_COLOR) line += COLOR_REST;
  
    for(var ix=level.length; ix<MAX_LEVEL_LENGTH; ix++) line += " ";
    
    line += " | ";
  
    //if (DO_COLOR) line += CSI + COLORS[level] + 'm';
    for(var ix=1; ix<arguments.length; ix++) {
        var val = arguments[ix];
        if (typeof val === 'undefined') val = 'undefined';
    
        if (options.inspect) {
          if (typeof val === 'string') {
            line += val;
          } else {
            line += Sys.inspect(val);
          }
        } else {
          line += val.toString();
        }
        
        line += " ";
    }
    if (DO_COLOR) line += COLOR_REST;

    // Now make sure newlines are properly replaced
    line = line.replace(/\n/gm, NEWLINE_HEADER);

    // And output it ...
    Sys.puts(line);
}


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Normal versions

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments as strings at the DEBUG level
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.debug = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.DEBUG});
    logLine.apply(null, args);  
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments as strings at the INFO level. Also aliased as 'log'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.info = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.INFO});
    logLine.apply(null, args);  
}
exports.log = exports.info;

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments as strings at the WARN level. Also aliased as 'warning'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.warn = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.WARN});
    logLine.apply(null, args);  
}
exports.warning = exports.warn;

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments as strings at the ERROR level. Also aliased as 'error'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.err = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.ERROR});
    logLine.apply(null, args);  
}
exports.error = exports.err;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Inspect versions

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments using Sys.inspect at the DEBUG level
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.debugi = function() {
      var args = Array.prototype.slice.apply(arguments);
      args.unshift({level:exports.DEBUG, inspect:true});
      logLine.apply(null, args);  
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments using Sys.inspect at the INFO level. Also aliased as 'logi'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.infoi = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.INFO, inspect:true});
    logLine.apply(null, args);  
}
exports.logi = exports.infoi;

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments using Sys.inspect at the WARN level. Also aliased as 'warningi'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.warni = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.WARN, inspect:true});
    logLine.apply(null, args);  
}
exports.warningi = exports.warni;

///////////////////////////////////////////////////////////////////////////////
/**
 * Log all arguments using Sys.inspect at the ERROR level. Also aliased as 'erri'.
 *
 * @param {Object} arguments* - All arguments are logged
 * @type void
 */
exports.erri = function() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift({level:exports.ERROR, inspect:true});
    logLine.apply(null, args);  
}
exports.errori = exports.erri;

//----------------------------------------------------

///////////////////////////////////////////////////////////////////////////////
/**
 * Insert a horizontal rule in the logging output. Useful for visually separating
 * a particular group of log output.
 *
 * @param {String} ch - character to use for the line. Defaults to -
 * @type void
 */
exports.hr = function(ch) {
    line = "";

    if (ch) {
        for(var ix=0; ix<HR.length; ix++) {
            line += ch;
        }
    } else {
        line = HR;
    }

    Sys.puts(line);
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Logs the stack trace either from the based in exception or will generate a
 * new exception internally in order to have a stack trace. Obviously doing
 * that will have some crufty stuff in it, but it will also have none crufty
 * things.
 *
 * @param {Exception} ex - exception object to log. May be null. 
 * @type void
 */
exports.logStack = function(ex) {
    // Get an exception object
    var ex = ex || (function() {
        try {
            var _err = __undef__ << 1;
        } catch (e) {
            return e;
        }
    })();

    // Output the stacktrace
    logLine({level:exports.ERROR}, ex.stack);
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Similar to logStack but allows a function to be passed in that will stop
 * the stack trace. Useful if your code all sits behind a large framework
 * stack and you want to stop at the boundary of your code without caring about
 * the framework.
 *
 * @param {Exception} ex - exception object to log. May be null. 
 * @param {Object} opts - options for the log function. Entirely optional, but necessary
 *                          if you want to change the log level for example.
 * @type void
 */
exports.logStackUntil = function(lastFunc, opts) {
    // Get an exception object
    var ex = (function() {
        try {
            var _err = __undef__ << 1;
        } catch(e) {
            return e;
        }
    })();

    // Turn this into a usable array of things
    var stack = [];
    var lines = ex.stack.split('\n');

    // First 3 lines are BS from the generation of the error above
    lines.shift();
    lines.shift();
    // lines.shift();
    var opts = opts || {
        level: exports.INFO
    };
    var line;
    while (line = lines.shift()) {
        line = line.slice(7);

        var parts;
        if (line[0] === "[") {
            parts = [line, ""];
        } else {
            parts = line.split(" ");
        }

        if (lastFunc) {
            if ((parts[0] === lastFunc) || (parts[1] === lastFunc)) return;
        }

        line = parts[0];
        while (line.length < 30) line += " ";
        line += parts[1];

        logLine(opts, line);
        opts.continuation = true;
    }
}