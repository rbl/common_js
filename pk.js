/**
 * A PocketKnife of useful little things
 */

var L = require('log');
var Crypto = require("crypto");

// Private array of chars to use for uuids
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); 

/**
 * Generates a universally (more or less) uid by creating a random stream
 * of characters. Should be reasonably fine most of the time.
 */
exports.uuid = function(len) 
{
  var len = len || 20;
  var chars = CHARS;
  var uuid = [];
  var radix = chars.length;
  
  for (var i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
  return uuid.join('');
}

/**
 * Resolve back references (..) and (.) in filesystem paths.
 */
exports.resolvePath = function(basePath, child)
{
  var stack;
  if (basePath)
  {
    stack = basePath.split('/');
  }
  else
  {
    stack = [];
  }
  // L.warni("basePath=",basePath,"child=",child);
  // L.infoi("Stack is",stack);
  
  var list = child.split('/');
  if (list[0] === '') list.shift();
  //L.infoi("List is",list);
  
  for(var ix = 0; ix<list.length; ix++)
  {
    var el = list[ix];
    if (el === '.')
    {
      // Just skip it
    }
    else if (el === '..')
    {
      // Pop the previous element from the stack 
      stack.pop();
      // And now fail to put this one on the stack
    }
    else
    {
      // Just add this to the stack
      if (el) stack.push(el);
    }
  }
  
  var result = stack.join('/');
  if (basePath)
  {
    if (basePath[0] === '/' && result[0] !== '/')
    {
      result = '/' + result;
    }
  }
  else
  {
    if (child[0] === '/' && result[0] !== '/')
    {
      result = '/' + result;
    }
  }
  
  return result;
}

exports.stringifyDate = function(date, reference)
{
  reference = reference || new Date();
  
  var delta = reference - date;
  var deltaAbs = Math.abs(delta / 1000);
  
  var ret = "";
  
  // Less than a minute
  if (deltaAbs < 60)
  {
    return "just now";
  }
  
  // One minute to 1 hour
  if (deltaAbs < 3600)
  {
    var minutes = Math.floor(deltaAbs / 60);
    ret += minutes;
    ret += " minute";
    if (minutes > 1)
    {
      ret += "s";
    }
  }
  // 1 hour to 24 hours
  else if (deltaAbs < (24 * 3600))
  {
    var hours = Math.floor(deltaAbs / 3600);
    ret += hours;
    
    ret += " hour";
    if (hours > 1)
    {
      ret += "s";
    }
  }
  // 1 day to 1 month
  else if (deltaAbs < (30 * 24 * 3600))
  {
    var days = Math.floor(deltaAbs / (24 * 3600));
    ret += "over ";
    ret += days;
    ret += " day";
    if (days > 1)
    {
      ret += "s";
    }
  }
  else 
  {
    var months = Math.floor(deltaAbs / (30 * 24 * 3600));
    ret += "over ";
    ret += months;
    ret += " month";    
    if (months > 1)
    {
      ret += "s";
    }
  }
  
  if (delta > 0)
  {
    ret += " ago";
  }
  else
  {
    ret += " in the future";
  }
  
  return ret;
}

/**
  Turns a date object into a standardized string of the form
  YYYY-MM-DDThh:mm:ss.sTZD
*/
exports.isoFromDate = function(d)
{
  function pad(n){return n<10 ? '0'+n : n}
  function pad100(n){return n<100 ? '0'+pad(n) : n}
  
  return d.getUTCFullYear()+'-'
       + pad(d.getUTCMonth()+1)+'-'
       + pad(d.getUTCDate())+'T'
       + pad(d.getUTCHours())+':'
       + pad(d.getUTCMinutes())+':'
       + pad(d.getUTCSeconds())+'.'
       + pad(d.getUTCMilliseconds())+'Z';
}

/**
  Given a particular salt and password, return the hashed version.
  Standardized this here so it is usable for both checking and inserting password hashes.
*/
exports.hashPassword = function(password, salt)
{
  var hasher = Crypto.createHash("sha1");
  hasher.update(salt);
  hasher.update(password);

  return hasher.digest("base64");
}

/**
  Do a deep copy on an object. Works for pretty much everything, including
  arrays. If the object is complex and does lots of stuff in it's constructor
  where state must be modified later or something then a copy might not make
  sense, but that's not this routine's fault :P
*/
exports.deepCopy = function(src)
{
  if(typeof(src) != "object" || src == null)  return src;
  var newInstance = src.constructor();
  for(var i in src)
  {
    newInstance[i] = exports.deepCopy(src[i]);
  }
  return newInstance;
}