/**
 * Module dependencies.
 */

var Net = require("net");
var ChildProcess = require("child_process");
var Os = require("os");
var Util = require("util");
var Events = require("events");
var Constants = require('constants');

var Logger = require("logger");
var WebRequest = require("webRequest");
var PK = require("pk");
var Drones = require("drones");
var ServerConnection = require("./serverConnection");

/**
 * Construct a new MQServer.
 * 
 * @constructor
 */
function MQServer() {
    Events.EventEmitter.call(this);

    this.config = {};

    this.connectionByToken = {};
    this.pendingConnections = [];
}

Util.inherits(MQServer, Events.EventEmitter);

/**
 * Handler for the "connection" event for the net.Server instance
 * 
 * @param {net.Stream} stream The newly created stream instance
 */
MQServer.prototype.serverConnection = function(stream) {
    Logger.log("Accepting a new stream connection");

    // The connection will register itself with us once it tries to authenticate, but if
    // we don't hold on to it in the meantime, it would (probably) get garbage collected, which
    // would be not awesome.
    var connection = ServerConnection.create(this, stream);
    this.pendingConnections.push(connection);
}

/**
 * Handler for the "close" event of the Net.Server instance.
 */
MQServer.prototype.serverClose = function() {
    Logger.log("MessageQueueServer closed");
    this.closed = true;

    // Someone may care ...
    this.emit("close");
}

/**
 * Handler for the "error" event of the Net.server instance. Presumably one
 * of the most frequent errors could be EADDRINUSE just because of the way
 * OS's might keep sockets open for a moment after a process dies. Since we
 * want the server running pretty much all the time, if any error occurs, we
 * are just going to wait a moment (1 second) and try to re-open the server.
 *
 * @param {Error} err The error that occured.
 */
MQServer.prototype.serverError = function(err) {
    if (err.errno == Constants.EADDRINUSE) {
        Logger.warn("Address in use");
    }

    // No matter what, close and retry in 1 second
    Logger.warn(" closing and retrying in 1 second ...");
    var self = this;
    setTimeout(function() {
        self.server.close();
        self.server.listen(this.config.port, this.config.host);
    },
    1000);
}

/**
 * Actually start the server. It is expected that the config object has already
 * been updated for the MessageQueueServer instance before this method is called.
 */
MQServer.prototype.start = function() {
    
    Logger.log("Starting messageQueueServer with configuration", this.config);

    this.server = Net.createServer();
    var self = this;
    this.server.on("connection",
    function(stream) {
        self.serverConnection(stream)
    });
    this.server.on("close",
    function() {
        self.serverClose()
    });
    this.server.on("error",
    function(err) {
        self.serverError(err)
    });

    this.server.listen(this.config.port, this.config.host)
}


/**
 * Combination token (i.e. authentication) validation and registration of new connections.
 *
 * @param {String} token - The oauth token received on the connection
 * @param {ident} ident - The identity object for this client, contains lots of detail
 * @param {ServerConnection} connection - The actual connection object itself.
 * @param {function(err,authenticated)} next - Callback to be told if the connection is authenticated successfully
 * @returns true if authentication is fine, false if things are bad (i.e. bad token)
 * @type bool
 */
MQServer.prototype.registerConnection = function(token, ident, connection, next) {
    
    var self = this;
    
    // Take this connection out of "pending"
    var ix = self.pendingConnections.indexOf(connection);
    if (ix !== -1) {
        self.pendingConnections = self.pendingConnections.splice(ix, 1);
    }

    //Logger.infoi("my config is", this.config);


    // Make sure the token is allowed for this sort of thing
    
    self.config.tokenStore.get(token, function(err,session) {
        
        if (Logger.logErrorObj("Fetching oauth token", err)) {
            return next(err,false);
        }
        
        var allowed = false;
        Logger.infoi("For", token, "Got session", session);
        if (session && session.scopes) {
            for (ix in session.scopes) {
                var scope = session.scopes[ix];
                Logger.info("Checkin scope", scope);
                if (scope == "drone") {
                    allowed = true;
                    break;
                }
            }
        }

        if (!allowed) {
            Logger.warn("Couldn't authenticate that token, fail.");
            return next(null,false);
        }

        // Register the connection
        if (!self.config.registry) {
            Logger.errori("Got a new authenticated connection, but no drone registry. Denying the connection");
            return next(null,false);
        }

        Logger.info("Creating a new DroneConnection object");
        self.config.registry.register(token, ident, connection, function(err) {
            
            if (Logger.logErrorObj("Failed to register connection in registry",err)) {
                return next(err, false);
            }
            
            // Cool, they are all registered and stuff
            
            // Need to know when that connection closes so we can unregister it
            connection.on("close", function() {
                self.connectionClosed(ident, connection);
            });
            
            // And that's it!
            Logger.debug("Successful registration completed okalie dokalie");
            return next(null, true);
        });
    });
}

/**
 * Handler for the "close" event from MessageQueueConnection instances.
 *      
 * @param {String} token - the token used to register the connection originally
 * @param {MessageQueueConnection} connection - the connection itself
 */
MQServer.prototype.connectionClosed = function(token, connection) {
    if (this.config.registry) {
        this.config.registry.unregister(token);
    }
}


/**
 * Create a new MQServer  
 * @type MQServer
 */
exports.create = function() {
    return new MQServer();
}
