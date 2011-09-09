/*****
 * Copyright (c) 2011 Tom Seago
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation 
 * files (the "Software"), to deal in the Software without 
 * restriction, including without limitation the rights to use, 
 * copy, modify, merge, publish, distribute, sublicense, and/or 
 * sell copies of the Software, and to permit persons to whom 
 * the Software is furnished to do so, subject to the 
 * following conditions:
 * 
 * The above copyright notice and this permission notice shall be 
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR 
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


/**
 * Module Dependencies
 */
var Util = require('util');

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

exports.SEPARATOR_CHAR = false;

exports.DEBUG = 3;
exports.INFO =  2;
exports.WARN =  1;
exports.ERROR = 0;

var logLevelNames = [
    "ERROR",
    "WARNING",
    "INFO",
    "DEBUG",
]

exports.logLevel = exports.DEBUG;

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

exports.DO_COLOR = true;

function d2(num) {
    return (num < 10 ? "0" : "") + num;
}

function d3(num) {
    return (num < 100 ? "0" : "") + (num < 10 ? "0" : "") + num;
}

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
 *                  options.inspect - if true the Util.inpect method will be used instead of the to_string method for each argument
 * @param {Object} other arguments - All other arguments are output to the log stream either 
 *                                   using their to_string method or by calling Util.inspect on them
 * @type void
 */
function logLine(options) {
    var level = exports.INFO;
    if (typeof options.level !== "undefined") level = options.level;
    if(exports.logLevel < level)
        return;
    
    var line = "";
    if (options.continuation) {
        line += CONTINUATION_SPACE;
    } else {
        var d = new Date();
        line += d2(d.getHours()) + ":" + d2(d.getMinutes()) +":"+ d2(d.getSeconds()) +":"+ d3(d.getMilliseconds()) + " ";
        while(line.length < CONTINUATION_SPACE.length) line += " "; 
    }
  
    if (exports.DO_COLOR) line += CSI + COLORS[level] + 'm';
    line += logLevelNames[level].slice(0,MAX_LEVEL_LENGTH);
    //if (exports.DO_COLOR) line += COLOR_REST;
  
    for(var ix=logLevelNames[level].length; ix<MAX_LEVEL_LENGTH; ix++) line += " ";
    
    line += " | ";
  
    //if (exports.DO_COLOR) line += CSI + COLORS[level] + 'm';
    for(var ix=1; ix<arguments.length; ix++) {
        var val = arguments[ix];
        if (typeof val === 'undefined') val = 'undefined';
    
        if (options.inspect) {
            if (typeof val === 'string') {
                line += val;
            } else {
                line += Util.inspect(val);
            }
        } else {
            if (val!=null) {
                line += val.toString();
            } else {
                line += "null";
            }
        }
        
        if (exports.SEPARATOR_CHAR)  line += exports.SEPARATOR_CHAR;
    }
    if (exports.DO_COLOR) line += COLOR_REST;

    // Now make sure newlines are properly replaced
    line = line.replace(/\n/gm, NEWLINE_HEADER);

    // And output it ...
    console.log(line);
}
exports.logLine = logLine;

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
 * Log all arguments using Util.inspect at the DEBUG level
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
 * Log all arguments using Util.inspect at the INFO level. Also aliased as 'logi'.
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
 * Log all arguments using Util.inspect at the WARN level. Also aliased as 'warningi'.
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
 * Log all arguments using Util.inspect at the ERROR level. Also aliased as 'erri'.
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

    console.log(line);
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
    var createdEx = false;
    
    var msg = null;
    if ((typeof ex) === "string") {
        msg = ex;
        ex = null;
    }
    ex = ex || (function() {
        createdEx = true;
        try {
            var _err = __undef__ << 1;
        } catch (e) {
            return e;
        }
    })();

    var stack = ex.stack;
    if (createdEx && stack) {
        // Take the string apart and rip of the top 3 lines
        var lines = stack.split("\n");
        
        if (lines.length > 3) {
            stack = lines.slice(3,lines.length).join("\n");
        }
    }

    if (msg) {
        stack = msg + "\n" + stack;
    }
    
    // Output the stacktrace
    logLine({level:exports.ERROR}, stack);
};

exports.logStackTrace = exports.logStack;

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


///////////////////////////////////////////////////////////////////////////////
/**
 * Convenience method for logging errors returned to callbacks. If the error 
 * parameter is null nothing will be output so it's save to always call this
 * function in the async callback and things will only be output if an error
 * has actually occurred.
 * 
 * If the error parameter is a real Error object with a stack associated with
 * it then the stack is also logged as a continuation in a nice format.
 *
 * @param {String} msg - App specific message to prefix the returned error message with.
 * @param {Error} error - An object representing the error that occurred. This object
 *                  is also used as the return value of the function to allow using
 *                  the function in an if statement.
 * @returns The error object that was passed in to it
 * @type Error
 */
exports.logErrorObj = function(msg, error) {
    if (!error) return null;
    
    this.error(msg,error);
    if (error.stack) {
        logLine({level:exports.ERROR, continuation:true}, error.stack);
    }
    
    return error;
}
