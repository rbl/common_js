var Sys = require('sys');

var LEVEL_SPACE = "     ";
var MAX_LEVEL_LENGTH = LEVEL_SPACE.length;
var CONTINUATION_SPACE = "             "
var NEWLINE_HEADER = "\n" + CONTINUATION_SPACE + LEVEL_SPACE + " | "
var HR = "-----------------------------------------------------------------------"

var CSI = '\x1B['

var COLOR_REST = CSI + "m"

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

var COLORS = {}
COLORS[exports.DEBUG] = "32;22";
COLORS[exports.INFO] = "39;22";
COLORS[exports.WARN] = "34;1";
COLORS[exports.ERROR] = "31;1";

var DO_COLOR = true;

function logLine(options)
{
  var level = options.level || exports.INFO;
  
  
  var line = "";
  if (options.continuation)
  {
    line += CONTINUATION_SPACE;
  }
  else
  {
    var d = new Date();
    line += d.getHours() + ":" + d.getMinutes() +":"+ d.getSeconds() +":"+ d.getMilliseconds() + " ";
    while(line.length < CONTINUATION_SPACE.length) line += " "; 
  }
  
  if (DO_COLOR) line += CSI + COLORS[level] + 'm';
  line += level.slice(0,MAX_LEVEL_LENGTH)
  //if (DO_COLOR) line += COLOR_REST;
  
  for(var ix=level.length; ix<MAX_LEVEL_LENGTH; ix++) line += " ";
  line += " | "
  
  //if (DO_COLOR) line += CSI + COLORS[level] + 'm';
  for(var ix=1; ix<arguments.length; ix++)
  {
    var val = arguments[ix];
    if (typeof val === 'undefined') val = 'undefined';
    
    if (options.inspect)
    {
      if (typeof val === 'string')
      {
        line += val;
      }
      else
      {
        line += Sys.inspect(val);
      }
    }
    else
    {
      line += val.toString();
    }
    line += " ";
  }
  if (DO_COLOR) line += COLOR_REST;
  
  // Now make sure newlines are properly replaced
  line = line.replace(/\n/gm, NEWLINE_HEADER)
  
  // And output it ...
  Sys.puts(line)
}


//----------------------------------------------------
// Normal versions

exports.log = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.INFO});
  logLine.apply(null, args);
}

exports.debug = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.DEBUG});
  logLine.apply(null, args);  
}

exports.info = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.INFO});
  logLine.apply(null, args);  
}

exports.warn = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.WARN});
  logLine.apply(null, args);  
}
exports.warning = exports.warn;

exports.err = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.ERROR});
  logLine.apply(null, args);  
}
exports.error = exports.err;

//----------------------------------------------------
// Inspect versions

exports.logi = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.INFO, inspect:true});
  logLine.apply(null, args);
}

exports.debugi = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.DEBUG, inspect:true});
  logLine.apply(null, args);  
}

exports.infoi = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.INFO, inspect:true});
  logLine.apply(null, args);  
}

exports.warni = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.WARN, inspect:true});
  logLine.apply(null, args);  
}
exports.warningi = exports.warni;

exports.erri = function()
{
  var args = Array.prototype.slice.apply(arguments);
  args.unshift({level:exports.ERROR, inspect:true});
  logLine.apply(null, args);  
}
exports.errori = exports.erri;

//----------------------------------------------------

exports.hr = function(char)
{
  line = "";

  if (char)
  {
    for(var ix=0; ix<HR.length; ix++)
    {
      line += char;
    }
  }
  else
  {
    line = HR;
  }
  
  Sys.puts(line);
}

exports.logStack = function(ex)
{
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

exports.logStackUntil = function(lastFunc, opts)
{
  // Get an exception object
  var ex = (function() {
    try {
      var _err = __undef__ << 1;
    } catch (e) {
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
  
  var opts = opts || {level:exports.INFO};
  var line;
  while (line = lines.shift())
  {
    line = line.slice(7);
    
    var parts;
    if (line[0] === "[") 
    {
      parts = [line,""];
    } 
    else 
    {
      parts = line.split(" ");
    }
    
    if (lastFunc)
    {
      if ((parts[0] === lastFunc) || (parts[1] === lastFunc)) return;
    }
    
    line = parts[0];
    while (line.length < 30) line += " ";
    line += parts[1];
    
    logLine(opts,line);
    opts.continuation = true;
  }
}