/**
 * Dependencies
 */
var Net = require("net");
var ChildProcess = require("child_process");
var Os = require("os");
var Util = require("util");
var Events = require("events");

var L = require("log");
var WebRequest = require("webRequest");
var PK = require("pk");
var Queue = require("./queue");

/**
 * MQClient constructor. Creates a client that is expecting to call out to a messageQueue.
 *
 * @returns a newly created MQClient object
 * @type MQClient
 * @constructor
 */
function MQClient() {
    Events.EventEmitter.call(this);

    // A default config. We expect this to be overriden externally
    this.config = {
        url: {
            host: "127.0.0.1",
            port: 3001,
        },
    };

    // This should come from the server, after we have our oauth token
    this.streamConfig = {
        host: "127.0.0.1",
        port: 4444,
    };

    this.outgoingQueue = [];

    this.incomingQueue = [];
    this.incomingPartial = "";
}

Util.inherits(MQClient, Events.EventEmitter);


MQClient.prototype.createIdentity = function(next) {
    var ident = {
        instanceId: PK.uuid(),
    };

    ident.persistentId = this.config.persistentId;
    if (Os.hostname) {
        // 0.5 and beyond
        ident.hostname = Os.hostname();
    } else {
        // Older node...
        ident.hostname = Os.getHostname();
    }

    // Get some system information here ...
    ChildProcess.exec("uname -a",
    function(err, stdout, stderr) {
        if (stdout) {
            ident.uname = stdout;
        }
        next(ident);
    })
}




MQClient.prototype.streamConnect = function() {
    L.logi("MessageQueue.streamConnect");

    // Always send the oauth token as the first message. We can stack other things
    // up behind it, but if the server hates our token it will just nuke the stream.
    var auth = {
        type: "oauth",
        oauth_token: this.oauth_token,
        oauth_type: "bearer"
    };
    this.queue.sendMessage(auth);
}

MQClient.prototype.streamError = function(error) {
    L.logi("MessageQueue.streamError", error)
    this.emit("error", error);
}

MQClient.prototype.queueClose = function(hadError) {
    L.logi("MQClient.queueClose");

    this.queue = null;

    // Propogate the event
    this.emit("close", hadError);
}

MQClient.prototype.startStream = function() {
    if (this.queue) {
        L.warni("A queue already exists. Not trying to start a new one");
        return;
    }

    L.log("Starting a new stream connection to", this.streamConfig.host, ":", this.streamConfig.port);

    var stream = Net.createConnection(this.streamConfig.port, this.streamConfig.host);

    // TODO: Establish secure credentials as necessary here
    var self = this;
    stream.on("connect",
    function() {
        self.streamConnect()
    });
    stream.on("error",
    function(error) {
        self.streamError(error)
    });

    this.queue = Queue.create(stream);
    this.queue.on("close",
    function() {
        self.queueClose();
    });

    this.queue.registerHandlers(this.config.handlers);
}

MQClient.prototype.start = function(callback) {
    L.infoi("Starting messageQueue with configuration endpoint", this.config.url);

    // Get an OAuth token
    var client_credentials = {
        client_id: this.config.client_id || "drone",
        client_secret: this.config.client_secret || "secret",
        grant_type: "client_credentials",
    }

    var self = this;
    this.createIdentity(function(ident) {
        client_credentials.drone_identity = ident;

        var url = PK.deepCopy(self.config.url);
        url.pathname = "/oauth/token";
        WebRequest.postJSON(url, client_credentials,
        function(err, response, grant) {
            if (err) return callback(err);

            if (grant.error) return callback(new Error(grant.error_description));

            self.oauth_token = grant.access_token;
            if (grant.droneConfig.host && grant.droneConfig.host.length > 0) {
                self.streamConfig.host = grant.droneConfig.host;
            } else {
                self.streamConfig.host = self.config.url.host;
            }

            if (grant.droneConfig.port) {
                self.streamConfig.port = grant.droneConfig.port;
            }

            // Start up the stream
            self.startStream();
        });
    });
}

MQClient.prototype.sendMessage = function(msg) {
    this.queue.sendMessage(msg);
}

module.exports.create = function() {
    return new MQClient();
}