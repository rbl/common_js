require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var Logger = require("logger");
var PK = require("pk");
var ResourceLock = require("resourceLock");


var resource = ResourceLock.create(2);

Logger.warn("Alice: Grabbing the lock bitches!");
resource.lock(function() {
    Logger.warn("Alice: I have a lock and I refuse to release it for some time to come!");
    Logger.warn("Alice: avail is",resource.available);
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

Logger.error("Emo: I want exclusivity!")
resource.exclusiveLock(function() {
    Logger.error("Emo: no one else may play! All mine! ");
    Logger.error("Emo: avail is",resource.available);
    
    Logger.warn("Alice: Here I go again ...");
    resource.lock(function() {
        Logger.warn("Alice: Got it! I'm so special.")
        Logger.warn("Alice: avail is",resource.available);

        Logger.warn("Alice: Giving it right back")
        resource.release();
        Logger.warn("Alice: avail is",resource.available);
    });
    
    Logger.debug("Bob: I go to!")
    resource.lock(function() {
        Logger.debug("Bob: I haz resource!");
        setTimeout(function() {
            Logger.debug("Bob: I gives uz resource.");
            resource.release();
        }, 2000);
    });

    Logger.info("Charles: I say good chaps, I hear there is a resource around here?")
    resource.lock(function() {
        Logger.info("Charles: Haha! I found it!, but giving it right back");
        resource.release();
    });
    
    Logger.error("Emo: Waiting before I give it up");
    setTimeout(function() {
        Logger.error("Emo: I'm out");
        resource.exclusiveRelease();
    },2000);
});