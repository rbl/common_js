var FS = require('fs');
var Events = require('events');
var Util = require("util");

var Logger = require('logger');

function CodeNames() {
    var self = this;
    Events.EventEmitter.call(this);
    
    this.words = {};
    
    Logger.info("reading code name words list");
    this.reader = FS.createReadStream(__dirname+"/codeNamesData.txt",{encoding:"utf-8"});
    
    this.reader.on("data", function onData(data) {
        if (!data) return;
        Logger.info("read - got some data");
        strBuffer += data;

        var ix;
        var last = 0;
        while ((ix = strBuffer.indexOf('\n', last)) != -1) {
            self.addWord(strBuffer.slice(last, ix));
            last = ix + 1;        
        }
        if (last > 0) strBuffer = strBuffer.slice(last);
    });
    this.reader.on("end", function onEnd() {
        Logger.info("read - end");
        // It can go away
        self.reader = null;
        self.haveData = true;

        if (!self.words.noun && !self.words.verb) {
            Logger.warn("No words loaded from the code names data list");
        }
        
        self.currentType = null;
        self.currentList = null;
        self.emit("ready", self);
    });
    this.reader.on("error", function onError(err) {
        Logger.info("read - error");
        Logger.logErrorObj("Reading code name word list", err);        
    });

    this.haveData = false;
    
    this.defaultStyle = "pattern";
}

Util.inherits(CodeNames, Events.EventEmitter);

module.exports.create = function() {
    return new CodeNames();
}

var shared = null;
module.exports.shared = function() {    
    if (!shared) shared = new CodeNames();
    return shared;
}

module.exports.getSimpleName = function() {
    return module.exports.shared().getSimpleName();
}

CodeNames.prototype.onReady = function onReady(cb) {
    if (this.haveData) return cb();
    
    this.once("ready", cb);
}

var strBuffer = "";

CodeNames.prototype.addWord = function(word) {
    if (!word || !word.length) return;
    
    if (word.indexOf(":::") === 0)
    {
        // It's a token for type
        this.currentType = word.slice(3).toLowerCase();
        this.currentList = this.words[this.currentType];
        if (!this.currentList) {
            this.currentList = [];
            this.words[this.currentType] = this.currentList;
        }
        return;
    }
    
    // It's a regular word, which means we better have a currentToken
    if (!this.currentList) {
        Logger.warn("Code name word data before first token - ignoring");
        return;
    }
    
    this.currentList.push(word);
}


function setDefOpt(opts, name, value) {
    if (typeof opts[name] === "undefined") {
        opts[name] = value;
        return true;
    }
    
    return false;
}

CodeNames.prototype.getName = function getName(opts) {
    opts = opts || {};
    
    // Setup some specific defaults
    if (!this.haveData) {
        Logger.info("getName called before we had code name data");
        return opts.defaultName;
    }

    setDefOpt(opts, "style", this.defaultStyle);
    
    var styleFunc = this["style_"+opts.style];
    if (typeof styleFunc !== "function") {
        Logger.errori("Invalid code name style '",opts.style,"'");
        return opts.defaultName;
    }
    
    return styleFunc.call(this, opts);
}

CodeNames.prototype.getSimpleName = function getSimpleName(opts) {
    opts = opts || {};
    opts.style = "simple";
    return this.getName(opts);
}

CodeNames.prototype.style_pattern = function style_pattern(opts) {
    
    setDefOpt(opts, "pattern", "Adjective Noun");
    setDefOpt(opts, "spaceChar", " ");
    
    var types = opts.pattern.split(" ");
    
    var out = "";
    var puncRE = /([a-zA-Z]+)(.*)/;
    for(var ix=0; ix<types.length; ix++) {
        var type = types[ix];
        if (!type) continue;
        
        var matches = puncRE.exec(type);
        var punc = null;
        if (matches) {
            type = matches[1];
            punc = matches[2];
        }
        
        var typeLower = type.toLowerCase();
        
        if (!this.words[typeLower]) {
            Logger.warn("No CodeName words for pattern type '",typeLower,"'. Ignoring");
            continue;
        }
        
        var word = this.getWord(typeLower);
        
        if (type[0] != typeLower[0]) {
            word = this.sentenceCase(word);
        }
        
        if (out.length > 0) out += opts.spaceChar;
        out += word;
        
        if (punc) out += punc;
    }
    
    return out;
}

CodeNames.prototype.getWord = function getWord(type) {
    var list = this.words[type];
    if (!list) return "";
    
    var ix = 0 | (Math.random() * list.length);
    return list[ix];
}

CodeNames.prototype.sentenceCase = function sentenceCase(word) {
    
    if (!word) return null;
    
    var words = word.split(" ");
    out = "";
    
    for(var i=0; i<words.length; i++) {
        var word = words[i];

        if (!word.length) continue;
        
        if (out.length > 0) out += " ";
        
        out += word[0].toUpperCase();
        out += word.slice(1);
    }
    
    return out;    
}


CodeNames.prototype.style_wild = function style_wild(opts) {
    var patterns = [
          "Adjective noun, adverb verb. Noun adverb verb."
        , "Adverb Verb"
        , "Adjective Noun"
        , "Noun Adverb Verb"
        , "Noun Adverb"
    ];
    
    opts.pattern = patterns[0 | Math.random() * patterns.length];
    return this.style_pattern(opts);
}

CodeNames.prototype.style_simple = function style_wild(opts) {
    opts.pattern = "noun noun";
    opts.spaceChar = "_";
    return this.style_pattern(opts);
}

// When the module is loaded spur the loadind of the singleton
module.exports.shared();

////////////////////////////////////////////////////////////
// Test
if (!module.parent) {
    var names = new CodeNames();
    
    names.on("ready", function() {
        var opts = {spaceChar: " "};
        
        opts.pattern = "Adjective noun, adverb verb. Noun adverb verb.";
        opts.style = "simple";
        for (var ix =0; ix<10; ix++) {
            console.log(names.getName(opts));
        }
    });
}

