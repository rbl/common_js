/**
 * A persistent registry of stuff. Likely used for persistent configuration
 * data because, you know, that's handy.
 */
 
var FS = require("fs");
var Logger = require("logger");

function Registry(filepath) {
    
    this.data = {};
    this.isDirty = false;
    this.filepath = filepath;
    
    // Read in the starting data. Do this synchronously because it's
    // probably reasonably important
    try {
        var json = FS.readFileSync(this.filepath);
        
        if (json) {
            this.data = JSON.parse(json);
        }
    } catch (e) {
        Logger.warning("Failed to load initial registry data from ",filepath," : ",e);
    }
}
module.exports = Registry;

Registry.prototype.set = function set(name, value) {
    
    this.data[name] = value;
    this.isDirty = true;
}

Registry.prototype.get = function get(name, value) {
    
    var ret = this.data[name];
    
    if (typeof value === 'undefined') return ret;
    
    if (!ret) return value;
    return ret;
}

Registry.prototype.save = function save() {
    
    if (!this.isDirty) return;
    
    try {
        FS.writeFileSync(this.filepath, JSON.stringify(this.data));
        this.isDirty = false;
    } catch (e) {
        Logger.logErrorObj("While saving registry data to "+this.filepath, e);
    }
}