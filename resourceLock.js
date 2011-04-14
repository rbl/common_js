/**
 * Dependencies
 */

var Logger = require("logger");
//var PK = require("pk");

exports.INFINITE = 99999999; // Well, ALMOST infinite ...

function ResourceLock(available) {
    if ("undefined" == typeof available) available = 1;
    
    this.maxAvailable = available;
    this.available = available;
    this.waiting = [];
    this.exclusivelyLocked = false;
}

exports.create = function(available) {
    return new ResourceLock(available);
}

ResourceLock.prototype.getLock = function(waiter) {
    if (this.available > 0 && !this.exclusivelyLocked) {
        this.available -= 1;
        return this.callWaiter(waiter);
    }
    
    // else, not right now buddy ...
    this.waiting.push(waiter);
}

ResourceLock.prototype.lock = function() {
    var args = Array.prototype.slice.apply(arguments);
    var func = args.pop();
    var waiter = {isExclusive:false, func:func, args:args};
    this.getLock(waiter);
}

ResourceLock.prototype.exclusiveLock = function() {
    var args = Array.prototype.slice.apply(arguments);
    var func = args.pop();
    var waiter = {isExclusive:true, func:func, args:args};
    this.getLock(waiter);
}

ResourceLock.prototype.release = function() {
    // TODO: Could do more to make sure only the holder of a lock releases it, but don't care right now

    // Make one more available than was there before.
    this.available += 1;

    // If an exclusive lock is held, then no one gets to be started until that exclusive lock 
    // is released.
    if (!this.exclusivelyLocked) {
        // Start up as many waiters as we have available slots
        while (this.available > 0 && this.waiting.length > 0) {
            this.available -= 1;
            var luckyWinner = this.waiting.shift();
            
            // Try to dispatch, which might fail if it requires exclusive access and doesn't have it yet
            if (!this.callWaiter(luckyWinner)) {
                // Aack! put everything back the way it was a moment ago and stop
                this.available += 1;
                this.waiting.unshift(luckyWinner);
                break;
            }
        }
    }    
}

ResourceLock.prototype.exclusiveRelease = function() {
    // Ok, no longer exclusively locked
    this.exclusivelyLocked = false;
    
    // And then it's just like the normal releases
    this.release();
}

ResourceLock.prototype.callWaiter = function(waiter) {
    // We could do this synchronously, but next tick makes it unwind the stack a little nicer I think
    if (waiter.isExclusive) {
        // Since our availability has been taken off of max, test for max-1 instead of max
        if (this.available != (this.maxAvailable-1)) {
            // Some else has a lock right now so we can't start this exclusive guy
            return false;
        }
        this.exclusivelyLocked = true;
    }
    
    process.nextTick(function() { 
        waiter.func.apply(waiter.args);
    });
    
    // That all went ok
    return true;
}

