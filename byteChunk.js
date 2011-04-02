/**
 * Dependencies
 */ 
var Net = require("net");
var Util = require("util");
var Events = require("events");

var Logger = require("logger");
var PK = require("pk");

// Stats
var count = 1;
var currentObjects = 1;

var totalBytesRead = 0;
var totalBytesWritten = 0;



/**
 * Constructor. Initializes a new chunk with a size for the chunk and needs to know
 * the maxEmptyChunks which is actually a property of the chain that the chunk is in.
 *
 * @param {int} size - Max number of bytes to hold in this individual chunk
 * @param {int} maxEmptyChunks - Max number of empty chunk objects to hold on the end of the chain
 * @returns A new chunk, ready for data
 * @type ByteChunk
 * @constructor
 */
function ByteChunk(size, maxEmptyChunks) {
    this.id = count++;
    currentObjects++;

    this.store = new Buffer(size);

    this.next = null;
    this.readOffset = 0;
    this.writeOffset = 0;

    this.maxEmptyChunks = maxEmptyChunks;
}

exports.create = function(size, maxEmptyChunks) {
    return new ByteChunk(size,maxEmptyChunks);
}

/**
 * Reads bytes from this chunk.  If all the bytes get used in this chunk,
 * the next chunk is accessed and so on until the request is satisfied or
 * there are no more bytes available.  Once bytes have been read, they are
 * removed from the chunk.
 */
ByteChunk.prototype.read = function(ba, off, len) {
    var desired = len;
    var have = this.writeOffset - this.readOffset;

    if (desired <= have) {
        // Easy, get it from here
        this.store.copy(ba, off, this.readOffset, this.readOffset+desired);
        this.readOffset += desired;
        totalBytesRead += desired;
        return desired;
    } else {
        // They want more than we have

        // Give them what we can
        this.store.copy(ba, off, this.readOffset, this.readOffset+have);
        this.readOffset += have;
        off += have;
        var haveRead = have;
        len -= have;

        totalBytesRead += haveRead;

        // Since we are maxed out, recurse down the chain to the next chunk.
        if (this.readOffset == this.store.length) {
            // We are maxed, try the next guy in line
            if (!this.next) {
                // No more data known to anyone
                return haveRead;
            } else {
                // Recurse to the next chunk
                var ret = haveRead + this.next.read(ba,off,len);
                return ret;
            }
        } else {
            // we are max'ed out and that's all there is
            return haveRead;
        }
    }
}


/**
 * Works the same as the other read method, but only reads 1 byte.  If there
 * are no bytes available, it returns -1.
 */
ByteChunk.prototype.readByte = function() {
    var desired = 1;
    var have = this.writeOffset - this.readOffset;

    if (desired <= have) {
        this.readOffset += desired;
        totalBytesRead += desired;
        return this.store[this.readOffset-1];
    } else {
        // They want more than we have

        // Since 1 byte is more than we have, we're on to the next one
        if (this.readOffset == this.store.length) {
            if (!this.next) {
                // We were not able to read anything
                return -1;
            } else {
                return this.next.readByte();
            }
        } else {
            // How did we get here? We are not maxed out, but 1 byte is to much?
            // This makes no sense, but return a failure response
            return -1;
        }
    }
}
 
/**
 * Write some data into this chunk and add new chunks as needed.
 *
 * @param {Buffer} ba - The data to write
 * @param {int} off - Offset to begin reading data from ba
 * @param {int} len - Amount of data to read from ba
 * @returns The chunk on which the write operation completed, which is the
 *          the chunk on which the next write operation should begin.
 * @type ByteChunk
 */
ByteChunk.prototype.write = function(ba, off, len) {
    var toWrite = len;
    if (toWrite > this.store.length - this.writeOffset) {
        toWrite = this.store.length - this.writeOffset;
    }

    if (toWrite>0) {
        // There is some space to store at least part of the data in this chucnk
        ba.copy(this.store, this.writeOffset, off, off+toWrite);

        this.writeOffset += toWrite;
        off += toWrite;
        len -= toWrite;
        totalBytesWritten += toWrite;
    }

    if (len>0) {
        // Not all the data has been written, so we need another chunk
        if (!this.next) {
            // We don't have a recycled guy, so add someone
            this.next = new ByteChunk(this.store.length, this.maxEmptyChunks);
        }

        return this.next.write(ba,off,len);
    } else {
        // Everything was already written out just fine
        return this;
    }
}

/**
 * Write a single byte to this chunk (or the next one as necessary)
 *
 * @param {int} val - The byte to write
 * @returns The chunk on which the write operation completed, which is the
 *          the chunk on which the next write operation should begin.
 * @type ByteChunk
 */
ByteChunk.prototype.writeByte = function(val) {
    var toWrite = 1;
    totalBytesWritten += 1;

    if (toWrite > this.store.length - this.writeOffset) {
        // Need to pass it on
        if (!this.next) {
            this.next = new ByteChunk(this.store.length, this.maxEmptyChunks);
        }

        return this.next.write(val);
    } else {
        // We have the power! (and the space too...)
        this.store[this.writeOffset] = val;
        this.writeOffset += 1;
        return this;
    }
}


/**
 * Returns the current head node of the list for reading.
 * 
 * This is where all the interesting recycling logic happens that moves nodes
 * to the end of the list as they are learned to be empty.
 * 
 * This should get called pretty frequently, probably before every read, to
 * make sure that as things are used up they move to the end.
 *
 * @returns The head of the list which should be used for the most efficient
 *          read operations
 * @type ByteChunk
 */
ByteChunk.prototype.getHead = function() {
    // If I have data, I'm the head
    if (this.writeOffset > this.readOffset) {
        return this;
    }

    // Since I have no data, I may or may not be the head

    // If there is no next I am the Alpha and the Omega. Both the head and the tail
    if (!this.next) return this;

    // Okay, at this point, either some node has data (and thus recursing into
    // the getHead() method will find the first such node), or no nodes have
    // data and I actually need to get out of the way because in that case, both
    // the head and the tail as thought of by the ByteDeque class should be the
    // same node.  Otherwise, you would not write data at the head of the empty
    // list, you would write it at the end, which ain't right.  That is, if there
    // is a chain of 5 empty nodes, you need to both read and write from the
    // beginning of that chain.

    // First step though, is to recurse looking for a head node which will be
    // somewhere in the list after us - possibly at the end.
    var head = this.next.getHead();

    // We determined up above that we have no data, so make sure we are reset
    this.readOffset = 0;
    this.writeOffset = 0;

    // We have to break the chain and become a free node or else we would cause
    // a loop in the chain, and that would suck.
    this.next = null;

    // Now we offer ourself to the new head to be bubbled down to the tail and
    // possibly connected into the list.
    // Note that we have already recursed down the list one direction and are
    // now bubbling back up towards the head. That means all of our children
    // have already offered themselves to the node we have in head prior
    // to returning that node to us. Thus, they ain't really our children anymore,
    // which is fine. They took care of themselves.
    head.offerFreeNode(this, 0);

    // Okay, we have either been attached to the tail of the list or not 
    // (if the maxNumEmptyNodes has been reached prior to us, we just float off
    // into gc heaven)
    // Tell our caller about the new head
    return head;
}

/**
 * How an emptied out node offers it self as a potential subservient node
 * to the current head node. The node propogates down the list until enough
 * empty nodes are hanging off the end and after that just gets dropped.
 * 
 * Interestingly enough we have to look at where data will next be written
 * to figure out the true tail of the list.
 *
 * @param {ByteChunk} free - The node being offered
 * @param {int} numEmpty - The number of empty nodes encountered so far
 * @type void
 */
ByteChunk.prototype.offerFreeNode = function(free, numEmpty) {
    //L.logi("Node",free.id,"is being offered to node",this.id,"numEmpty=",numEmpty);
    if (this.writeOffset < this.store.length) {
        // We have space for writing
        if (!this.next) {
            // Since we don't have a next, and by definition of being in this function
            // we haven't yet encountered enough empties to stop, take this node
            this.next = free;
        } else {
            // We don't need it, so pass it on if we haven't yet hit the max
            if (numEmpty < this.maxEmptyChunks) {
                this.next.offerFreeNode(free, numEmpty+1);
            }
        }
    } else {
        // We have no space for writing, move along please
        if (!this.next) {
            // I have no one after me though. Let there be space!
            this.next = free;
        } else {
            // I already have a minion, I will pawn this free node off on him
            this.next.offerFreeNode(free,numEmpty);
        }
    }
}

/**
 * How much datas do we has? This recurses down the chain to find all data
 * stored in all chunks so when called on the head it will be the entire amount
 * of live data in the chain.
 *
 * @returns The amount of data contained in the entire chain.
 * @type int
 */
ByteChunk.prototype.getSize = function() {
    var size = this.writeOffset - this.readOffset;

    if (this.next) {
        // Add my size to that of Mr. Next
        return size + this.next.getSize();
    } else {
        // No one after me, just the size
        return size;
    }
}

/**
 * Returns a string containing useful debugging information
 *
 * @type String
 */
ByteChunk.prototype.toString = function() {
    return "ByteChunk(ro="+this.readOffset+",wo="+this.writeOffset+
            ",s.l="+this.store.length+",next?="+(this.next ? "Yes": "No")+"){"+this.id+"}";
}
