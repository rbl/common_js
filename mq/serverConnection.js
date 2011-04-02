/**
  * Dependencies
  */
var Util = require("util");
var Events = require("events");

var Logger = require("logger");
var PK = require("pk");
var Queue = require("./queue");

/**
 * ServerConnection constructor
 *
 * @param {MQServer} mqServer - Our parent server instance
 * @param {Stream} stream - The fresh stream from the acceptance in mqServer
 * @returns A new ServerConnection
 * @type ServerConnection
 * @constructor
 */
function ServerConnection(mqServer, stream) {
    Events.EventEmitter.call(this);

    this.parent = mqServer;

    // Configure the stream
    // TODO: Establish secure credentials as necessary here
    var self = this;

    this.queue = Queue.create(stream);
    // Setup a hook so that we can veto unauthenticated messages
    this.queue.preDispatchHook = function(msg) {
        self.preDispatchAuthenticator(msg);
    };
    this.queue.on("close", function(hadError) { self.queueClosed(hadError); });
}

Util.inherits(ServerConnection, Events.EventEmitter);

exports.create = function(parent, stream) {
    return new ServerConnection(parent, stream);
}

/**
 * Used to make sure that no incoming messages are passed from this queue until the
 * oauth authentication message has been successfully received and the queue is registered
 * with our parent server.
 *
 * @param {Object} msg - Message received from the client, should be the oauth message
 * @returns True if authenticated
 * @type _type_
 */
ServerConnection.prototype.preDispatchAuthenticator = function(msg) {
    if (this.authenticated) {
        // Oops! Don't need to be hooked anymore
        delete this.queue.preDispatchHook;
        return true;
    }

    Logger.infoi("Attempting authentication using", msg);
    if (msg.type !== "oauth") {
        Logger.warni("While unauthenticated, ignoring message because it's the wrong type", msg);
        return false;
    }

    var token = msg.oauth_token;
    if (!token) {
        Logger.warni("Authentication message has no oauth_token. Sending an error message", token);
        this.queue.sendMessage({
            type: "error",
            description: "No oauth_token in authentication message"
        });
        return false;
    }

    // Ok, let's see if that token is good sauce.
    // Since everything MUST have an identifier, make one up if the client didn't send one (lowsy client!)
    // Using the token for an identifier would be a horrible idea because the token grants
    // identity along with it's associated authorizations.
    var ident = msg.ident || PK.uuid();
    if (!this.parent.registerConnection(token, ident, this)) {
        Logger.warni("Authentication failed for", token);
        this.queue.sendMessage({
            type: "error",
            description: "Invalid authentication token"
        });
        return false;
    }

    // It's all good!
    this.authenticated = true;

    // Don't need the hook anymore
    delete this.queue.preDispatchHook;

    // Don't allow the authentication message to be shown to anyone else
    return false;
}

ServerConnection.prototype.queueClosed = function(hadError) {
    // Drop the stream and try to restart the message queue
    Logger.log("queue closed, hadError", hadError);

    // Pass on the close event. This should unregister us from that token and stuff
    this.emit("close");
}

ServerConnection.prototype.close = function() {
    this.queue.close();
}


