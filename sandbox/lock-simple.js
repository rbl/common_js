require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var Logger = require("logger");
var PK = require("pk");
var ResourceLock = require("resourceLock");


var resource = ResourceLock.create(1);

Logger.warn("Alice: Grabbing the lock bitches!");
resource.lock(function() {
    Logger.warn("Alice: I have the lock and I refuse to release it for some time to come!");
    setTimeout(function() {
        Logger.warn("Alice: Unlocking the resource");
        resource.release();
    }, 2000);
});

Logger.debug("Bob: I can haz resource?")
resource.lock(function() {
    Logger.debug("Bob: I haz resource!");
    setTimeout(function() {
        Logger.debug("Bob: I gives uz resource.");
        resource.release();
    }, 2000);
});