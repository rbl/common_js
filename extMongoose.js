var Mongoose = require('mongoose');
var Model = Mongoose.Model;
var db = Mongoose.connection.db; 
var GridStore = Mongoose.mongo.GridStore;

Model.prototype.gridStoreRead = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }
    GridStore.read(db, this._id, function (error, data){
        
        return callback(error, data);
    });
};

Model.prototype.gridStoreStream = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, null);
    }
    var gridStore = new GridStore(db, this._id, "r");
    gridStore.open(function(error, gridStore) {
        
        return callback(error, gridStore.stream(true));
    });    
}

Model.prototype.gridStoreExists = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error, false);
    }
    GridStore.exist(db, this._id, function(error, result) {
          
          return callback(error, result);
    });
}

function writeGridStore(name, permissions, data, isFile, callback) {
    
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

Model.prototype.gridStoreWrite = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w", data, false, function (error){
        return callback(error);
    });
}

Model.prototype.gridStoreAppend = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w+", data, false, function (error){
        return callback(error);
    });
}

Model.prototype.gridStoreWriteFile = function (data, callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    writeGridStore(this._id, "w", data, true, function (error){
        return callback(error);
    });
}

Model.prototype.gridStoreDelete = function (callback) {
    
    if (!this._id) {
        
        var error = "Object doesn't have an id";
        return callback(error);
    }
    GridStore.unlink(db, this._id, function (error, gridStore) {
        
        return callback(error);
    });
}