console.log("Beginning in "+__dirname);
require.paths.unshift(__dirname);
require.paths.unshift(__dirname + '/..');

var L = require("log");
var PK = require("pk");
var ByteChunk = require("byteChunk");

////////////

var head = ByteChunk.create(5,0);
var tail = head;

var four = new Buffer("1234");
var five = new Buffer("ABCDE");
var twenty = new Buffer("x1x2x3x4x5x6x7x8x9x0");
var tfour = new Buffer(4);
var tthirty = new Buffer(30);
var tten = new Buffer(10);

// tail = tail.write(four,0,4);
// tail = tail.write(five,0,5);
// head = head.getHead();
// var i = head.read(tthirty, 0, 5);
// 
// L.logi("Read",i," : ",tthirty.slice(0,i));
// 
// tail = tail.write(twenty, 10, 10);
// tail = tail.write(twenty, 10, 10);
// tail = tail.write(twenty, 10, 10);
// 
// for (var x=0; x<=20; x++)
// {
//   head = head.getHead();
//   i = head.read(tten,0,10);
// 
//   head = head.getHead();
//   head.write(four, 0, 4);
// 
//   L.logi("Read",i," : ",tthirty.slice(0,i));  
// }

function testWriteFour()
{
  L.log("testWriteFour()");
  var head = ByteChunk.create(5,0);
  
  head.write(four,0,4);
  L.log("size=",head.getSize());
  
  head = head.getHead();
  var count = head.read(tthirty, 0, 5);
  
  L.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
  L.log("size=",head.getSize());
}

function testWriteFourFive()
{
  L.log("testWriteFourFive()");
  var head = ByteChunk.create(5,0);
  
  head.write(four,0,4);
  head.write(five,0,5);
  
  head = head.getHead();
  var count = head.read(tthirty, 0, 5);
  
  L.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
  
}


function testWriteTwenties()
{
  L.log("testWriteTwenties()");
  
  var head = ByteChunk.create(5,0);
  
  head.write(twenty,10,10);
  
  head = head.getHead();
  var count = head.read(tthirty, 0, 5);  
  L.logi("Read",count," bytes >",tthirty.slice(0,count).toString(), "<");
  
  head.write(twenty,10,10);
  head.write(twenty,10,10);
  head.write(twenty,10,10);
  
  //Now read a bunch of stuffs
  for (var x=0; x<=20; x++)
  {
    L.logi("Iteration",x)
    head = head.getHead();
    L.logi("Trying to read 10 bytes");
    count = head.read(tten,0,10);
    L.logi("Read",count," bytes >",tten.slice(0,count).toString(), "<");
  
    head = head.getHead();
    L.logi("Writting 4 more bytes, size is ",head.getSize());
    head.write(four, 0, 4);
  }
}

testWriteFour();
testWriteFourFive();
testWriteTwenties();

