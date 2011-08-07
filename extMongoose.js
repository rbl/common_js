var Mongoose = require('mongoose');
var Document = Mongoose.Document;
var GridStore = Mongoose.mongo.GridStore;


function nameFor(doc) {
    if (!doc._id) return null;
    
    return doc.collection.name + ":" + doc._id;
}

function writeGridStore(name, permissions, data, isFile, callback) {
    
    var db = Mongoose.connection.db; 
    var gridStore = new GridStore(db, name, permissions);
    gridStore.open(function(error, gridStore) {
        
        if (error) {
            return callback(error);
        }
        var func;
        if (isFile)
            func = gridStore.writeFile;
        else
            func = gridStore.write;
        gridStore.write(data, function(error, gridStore) {
            
            if (error) {
                return callback(error);
            }
            gridStore.close(function(error, result) {
                
                return callback(error);
            });
        });
    });
}

///////////////////////////////////////////////////////////////////////////////
/**
 * Simple wrapper for a Mongoose model to access the grid store file we are
 * associating with the model based on it's id.  This lets you use the
 * regular grid store streaming API read/write/close and ensures the file
 * is properly associated with the object.
 *
 * @param {String} mode - one of "r", "w", or "w+"
 * @param {function(error, gridStroe)} callback - receives any error and the opened 
 * gridStore object. See node-mongodb-native/lib/mongodb/gridfs/gridstore.js for details
 * @type void
 */

Document.prototype.gridStoreOpen = function (mode, callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }
    
    var db = Mongoose.connection.db; 
    var gridStore = new GridStore(db, name, mode);
    gridStore.open(callback);
};




Document.prototype.gridStoreRead = function (callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    var db = Mongoose.connection.db; 
    GridStore.read(db, name, function (error, data) {
        
        return callback(error, data);
    });
};

Document.prototype.gridStoreStream = function (callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    var db = Mongoose.connection.db; 
    var gridStore = new GridStore(db, name, "r");
    gridStore.open(function(error, gridStore) {
        
        return callback(error, gridStore.stream(true));
    });    
};

Document.prototype.gridStoreExists = function (callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    var db = Mongoose.connection.db; 
    GridStore.exist(db, name, function(error, result) {
          
          return callback(error, result);
    });
};

Document.prototype.gridStoreWrite = function (data, callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    writeGridStore(name, "w", data, false, function (error){
        return callback(error);
    });
};

Document.prototype.gridStoreAppend = function (data, callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    writeGridStore(name, "w+", data, false, function (error){
        return callback(error);
    });
};

Document.prototype.gridStoreWriteFile = function (data, callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    writeGridStore(name, "w", data, true, function (error){
        return callback(error);
    });
};

Document.prototype.gridStoreDelete = function (callback) {
    
    var name = nameFor(this);
    if ( !name ) {        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }

    var db = Mongoose.connection.db; 
    GridStore.unlink(db, name, function (error, gridStore) {
        
        return callback(error);
    });
};