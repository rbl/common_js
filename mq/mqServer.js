/**
 * Module dependencies.
 */

var Net = require("net");
var TLS = require("tls");
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
function MQServer(cfg) {
    Events.EventEmitter.call(this);

    this.config = cfg || {};

    this.connectionByToken = {};
    this.pendingConnections = [];
}

Util.inherits(MQServer, Events.EventEmitter);

/**
 * Create a new MQServer  
 * @type MQServer
 */
exports.create = function(cfg) {
    return new MQServer(cfg);
}

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
 * OS's might keep sockets open for a moment after a process dies. 
 * 
 * In the original version we would always try to re-listen here. Now that
 * will only happen if autoRestart is true in the configuration object. If
 * that value is set we will attempt to restart the server after a 1 second
 * delay.
 *
 * @param {Error} err The error that occured.
 */
MQServer.prototype.serverError = function(err) {
    if (err.errno == Constants.EADDRINUSE) {
        Logger.warn("Address in use");
    }

    // No matter what, close and retry in 1 second
    if (this.config.autoRestart) {        
        Logger.warn(" autoRestart: closing and retrying in 1 second ...");
        var self = this;
        setTimeout(function() {
            self.server.close();
            self.server.listen(this.config.port, this.config.host);
        }
        , 1000);
    } else {
        
        Logger.warn(" no autorestart. We are dead.");
    }
}

/**
 * Internal function to create the socket serer instance. If one exists it will
 * be overwritten - which is potentially sucky and bad, so that's why some other
 * method like either start() or getServerSocket() should be used instead because
 * they respect an existing server instance.
 */
MQServer.prototype.createSocketServer = function() {
    var self = this;

    var connectEvent = "connection";
    if (self.config.useTLS) {
        Logger.debug("Configuring to use TLS");
        var options = {
              key: self.config.key
            , cert: self.config.cert
        };
        
        self.server = TLS.createServer(options);
        connectEvent = "secureConnection";
    } else {
        self.server = Net.createServer();        
    }
    
    // These 3 event handlers are our real connection to the rest of the world
    self.server.on(connectEvent, function(stream) {
        self.serverConnection(stream)
    });
    self.server.on("close", function() {
        self.serverClose()
    });
    self.server.on("error", function(err) {
        self.serverError(err)
    });
}

/**
 * Actually start the server. It is expected that the config object has already
 * been updated for the MessageQueueServer instance before this method is called.
 */
MQServer.prototype.start = function() {
    
    if (this.initializedUsing) {
        Logger.error("Attempted to initialize an mqServer object multiple times. The first time was via ",this.initializedUsing);
        Logger.errori("My config is ",this.config);
        return null;
    }
    
    this.initializedUsing = "start()";
    
    Logger.log("Starting messageQueueServer with configuration", this.config);

    if (!this.server) {
        this.createSocketServer();
    }

    this.server.listen(this.config.port, this.config.host)
}

/** 
 * An alternative way to initialze the MQServer which is compatible with the cluster library.
 * Instead of calling listen ourself directly and then managing to sit on that socket and
 * restart if we get an error, this simply returns the configured server instance which can
 * be passed to cluster or which the caller can call listen() on themselves.
 */
MQServer.prototype.getSocketServer = function() {
    
    if (this.initializedUsing) {
        Logger.error("Attempted to initialize an mqServer object multiple times. The first time was via ",this.initializedUsing);
        Logger.errori("My config is ",this.config);
        return null;
    }
    
    this.initializedUsing = "getSocketServer()";
    
    if (!this.server) {
        this.createSocketServer();
    }
    
    return this.server;
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
            return next(null, true, ident);
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



