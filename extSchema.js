var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Lingo = require("lingo");
var EN = Lingo.en;

var Logger = require("logger");

function pluralizeIfNeeded(str) {
    if (EN.isPlural(str)) return str;
    
    return EN.pluralize(str);
}

function singularizeIfNeeded(str) {
    if (EN.isSingular(str)) return str;
    
    return EN.singularize(str);
}


///////////////////////////////////////////////////////////////////////////////
/**
 * Add the relationship of type "one" or type "many". This is factored out because
 * the differences between those two types are small.
 *
 * @param {_type_} _name_ _description_
 * @returns _description_
 * @type _type_
 */
function addRelationship(type, childModelName, fieldName, options) {
    
    options = options || {cascadeDelete: true};
    
    // Add a static to query all of them
    var findName = "find" + Lingo.capitalize(
        (
            type==="one" ? singularizeIfNeeded(childModelName) : pluralizeIfNeeded(childModelName)
        ));
    childModelName = singularizeIfNeeded(childModelName);
    
    // Logger.warni("Adding method named '",findName,"' to",this);
    this.virtual(findName).get(function() {
        return function(fields, next) {
            
            if ("function" === typeof fields) {
                next = fields;
                fields = null;
            }
        
            var model = mongoose.model(childModelName);
            if (!model) {
                next(new Error("Unable to find a model with name '"+childModelName+"'"));
                return;
            }
        
            query = {};
            query[fieldName] = this._id;
            if (fields) {                
                model.find(query, fields, function(error,list) {
                    if (type==="one") {
                        if (list && list.length>0) return next(error,list[0]);
                        return next(error,null);                        
                    } else {
                        return next(error,list);
                    }
                });            
            } else {
                model.find(query, function(error,list) {
                    if (type==="one") {
                        if (list && list.length>0) return next(error,list[0]);
                        return next(error,null);                        
                    } else {
                        return next(error,list);
                    }
                });            
            }
        };
    });
    
    
    // Add a pre-remove step to nuke all of the children
    if (options.cascadeDelete) {
        this.pre("remove", function(next, done) {
           next();
       
           this[findName](["_id"], function(error, list) {
              if (error) {
                  done(error);
                  return;
              } 
          
              var toKill = list.length;
              var killed = 0;
          
              for(var ix=0; ix<list.length; ix++) {
                  var child = list[ix];
              
                  child.remove(function(error) {
                      if (error) Logger.error("Error while removing",childModelName);
                      killed++;
                      if (killed === toKill) {
                          // that's all of them
                          done();
                      }
                  });
              }
           });
        });
    }
};


///////////////////////////////////////////////////////////////////////////////
/**
 * Add a "hasMany" relationship to a model where some other model points to 
 * this one with the given fieldName. 
 *
 * @param {String} childModelName - Name of the child model as registered with mongoose.model
 * @param {String} fieldName - Name in the child model of a field with type ObjectId which
 *                  points to this model
 * @type void
 */
Schema.prototype.hasMany = function(childModelName, fieldName, options) {
    
    addRelationship.call(this, "many", childModelName, fieldName, options);

};


///////////////////////////////////////////////////////////////////////////////
/**
 * Add a "hasOne" relationship to a model where some other model points to
 * this one with the given fieldName.
 *
 * @param {String} childModelName - Name of the child model as registered with mongoose.model
 * @param {String} fieldName - Name in the child model of a field with type ObjectId which
 *                  points to this model
 * @type void
 */
Schema.prototype.hasOne = function(childModelName, fieldName, options) {
    
    addRelationship.call(this, "one", childModelName, fieldName, options);
};


///////////////////////////////////////////////////////////////////////////////
/**
 * The belongsTo relationship is the inverse of the hasXXXX relationship. It 
 * always resolves to a single entity. It is placed on the model which has
 * the foreign key data stored inside it. This is typically the "child" model.
 *
 * @param {_type_} _name_ _description_
 * @returns _description_
 * @type _type_
 */
Schema.prototype.belongsTo = function(parentModelName, fieldName, options) {
    
    options = options || {};
    
    // Add a static to query all of them
    var findName = "find" + Lingo.capitalize(singularizeIfNeeded(parentModelName));
    parentModelName = singularizeIfNeeded(parentModelName);
    
    // Logger.warni("Adding method named '",findName,"' to",this);
    this.virtual(findName).get(function() {
        return function(fields, next) {
            
            if ("function" === typeof fields) {
                next = fields;
                fields = null;
            }
        
            var model = mongoose.model(parentModelName);
            if (!model) {
                next(new Error("Unable to find a model with name '"+parentModelName+"'"));
                return;
            }
        
            if (fields) {
                model.findById(this[fieldName], fields, function(error,parent) {
                    return next(error,parent);
                });            
            } else {
                model.findById(this[fieldName], function(error,parent) {
                    return next(error,parent);
                });            
            }
        };
    });
};

