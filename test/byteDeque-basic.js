console.log("Beginning in "+__dirname);
require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var Logger = require("logger");
var PK = require("pk");
var ByteDeque = require("byteDeque");

////////////

var four = new Buffer("1234");
var five = new Buffer("ABCDE");
var twenty = new Buffer("x1x2x3x4x5x6x7x8x9x0");
var tfour = new Buffer(4);
var tthirty = new Buffer(30);
var tten = new Buffer(10);


function testWriteFour()
{
  Logger.log("testWriteFour()");
  var que = ByteDeque.create();
  que.write(four,0,4);
  
  var count = que.read(tthirty, 0, 5);
  
  Logger.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
}

function testWriteFourFive()
{
  Logger.log("testWriteFourFive()");
  var que = ByteDeque.create();
  
  que.write(four,0,4);
  que.write(five,0,5);
  
  var count = que.read(tthirty, 0, 5);
  
  Logger.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
  
}


function testWriteTwenties()
{
  Logger.log("testWriteTwenties()");
  
  var que = ByteDeque.create();
  
  que.write(twenty,10,10);
  
  var count = que.read(tthirty, 0, 5);  
  Logger.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
  
  que.write(twenty,10,10);
  que.write(twenty,10,10);
  que.write(twenty,10,10);
  
  //Now read a bunch of stuffs
  for (var x=0; x<=20; x++)
  {
    Logger.logi("Iteration",x)
    Logger.logi("Trying to read 10 bytes");
    count = que.read(tten,0,10);
    Logger.logi("Read",count," bytes >",tten.slice(0,count).toString(), "<");
  
    Logger.logi("Writting 4 more bytes, size is ",que.getSize()," length is ",que.getLength(),que.size);
    que.write(four, 0, 4);
  }
}

testWriteFour();
testWriteFourFive();
testWriteTwenties();

