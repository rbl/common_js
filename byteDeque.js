/**
 * Dependencies
 */ 
var Net = require("net");
var Util = require("util");
var Events = require("events");

var Logger = require("logger");
var PK = require("pk");
var ByteChunk = require("./byteChunk");

/**
 * Create a new ByteDeque with the given size for each chunk and a maximum nuber of 
 * bytes. The max bytes can be set to -1 to disable the artifical limiting based on
 * data size. Similarly maxEmptyChunks can be set to a really big number and then
 * it will effectively let the dequeue fill up memory if necessary.
 *
 * @param {int} chunkSize - Number of bytes per chunk
 * @param {int} max - Max number of bytes to allow in the entire stream
 * @param {int} maxEmptyChunks - Number of empty chunks to keep around
 * @returns A newly constructed dequeue
 * @type ByteDequeue
 * @constructor
 */

function ByteDeque(chunkSize, max, maxEmptyChunks) {
    this.cacheTail = (maxEmptyChunks==Number.MAX_VALUE);
    this.head = ByteChunk.create(chunkSize, maxEmptyChunks);
    this.tail = this.head;
    this.max = max;
    this.size = 0;
}

exports.createFull = function(chunkSize, max, maxEmptyChunks) {
    return new ByteDeque(chunkSize, max, maxEmptyChunks);
}

exports.createSimple = function(chunkSize, max) {
    return new ByteDeque(chunkSize, max, 10);
}

exports.create = function() {
    return new ByteDeque(2048, -1, 10);
}

/**
 * Write data to the end of the deque from the given buffer
 *
 * @param {_type_} _name_ _description_
 * @throws Error if the max size of the buffer would be exceeded by this write.
 * @type void
 */
ByteDeque.prototype.write = function(ba, off, len) {
    if (!ba) return;

    if (this.max > -1) {
        if ( (ba.length + this.size) > this.size ) {
            throw new Error("Max size is "+this.max+" and already have "+this.size);
        }
    }

    // We can only cache the tail if we know the byte chunks will never be dropped. That's
    // more efficient, but the size grows over time
    if (this.cacheTail) {
        this.tail = this.tail.write(ba, off, len);
    } else {
        // Put the write in at the head. This will trickle down to the tail, but that
        // could be a long amount of recursing if the chain is long
        this.head = this.head.getHead();
        this.head.write(ba,off,len);
    }

    this.size += len;
}

/**
 * Write the entire contents of a buffer into the dequeue. This is a convenience function
 * that uses the generic write.
 *
 * @param {Buffer} buffer - The buffer to write
 * @type void
 */
ByteDeque.prototype.writeBuffer = function(buffer) {
    this.write(buffer, 0, buffer.length);
}


/**
 * Write a single byte to the deque
 *
 * @param {int} val - The single byte 0-255 to write
 * @type void
 */
ByteDeque.prototype.writeByte = function(val) {
    if (this.cacheTail) {
        this.tail = this.tail.writeByte(val)
    } else {
        this.head = this.head.getHead();
        this.head.writeByte(val);
    }
    this.size += 1;
}

/**
 * Reads from the front of the deque filling in the given output buffer. The number
 * of bytes read can quite possibly be less than the number asked for, so the number
 * that have been placed in the buffer is the return value.
 *
 * @param {Buffer} ba - The buffer to store the output into
 * @param {int} off - Offset to begin placing the read data at in the buffer
 * @param {int} len - Max length of data to read
 * @returns The amount actually read
 * @type int
 */
ByteDeque.prototype.read = function(ba,off,len) {
    this.head = this.head.getHead();

    var aread = this.head.read(ba,off,len);

    this.size -= aread;
    return aread;
}

/**
 * Try to fill up the entire buffer.
 *
 * @param {Buffer} buffer - Buffer object to be filled
 * @returns The amount actually read
 * @type int
 */
ByteDeque.prototype.readBuffer = function(buffer) {
    return this.read(buffer,0,buffer.length);
}

/**
 * Read a single byte. If there are no bytes available returns -1. Bytes are
 * returned in the lower 8 bits of a larger int, so effectively as unsigned
 * bytes, thus allowing the -1 to be a distinct value.
 *
 * @returns The byte read or -1 if there are no bytes
 * @type int
 */
ByteDeque.prototype.readByte = function() {
    this.head = head.getHead();
    this.size -= 1;
    return this.head.readByte();
}

/**
 * Return the total size of all bytes currently in the deque. This is a 
 * non-cached version of the size which means it's moderately expensive
 * to call. The length() method is preferred because it is cached.
 *
 * @returns The calculated total size of the deque
 * @type int
 */
ByteDeque.prototype.getSize = function() {
    this.head = this.head.getHead();
    return this.head.getSize();
}

/**
 * The cached size of the deque. Generally preferred over getSize.
 *
 * @returns The cached size of the bytes in the deque.
 * @type int
 */
ByteDeque.prototype.getLength = function() {
    return this.size;
}

