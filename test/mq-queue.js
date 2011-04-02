console.log("Beginning in "+__dirname);
require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var Logger = require("logger");
var PK = require("pk");
var ByteDeque = require("byteDeque");

////////////////////