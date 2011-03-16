console.log("Beginning in "+__dirname);
require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var L = require("log");
var PK = require("pk");
var ByteDeque = require("byteDeque");

////////////////////