// Quicksort library
Array.prototype.swap=function(a, b) {
  var tmp=this[a];
  this[a]=this[b];
  this[b]=tmp;
}

function partition(array, begin, end, pivot, comparator) {
  var piv=array[pivot];
  array.swap(pivot, end-1);
  var store=begin;
  var ix;
  for(ix=begin; ix<end-1; ++ix) {
    // Looking for less than or equal
    if(comparator(array[ix],piv) < 1) {
      array.swap(store, ix);
      ++store;
    }
  }
  array.swap(end-1, store);
  return store;
}

function qsort(array, begin, end, comparator) {
  if(end-1>begin) {
    var pivot = begin + Math.floor(Math.random()*(end-begin));
    pivot = partition(array, begin, end, pivot, comparator);
    qsort(array, begin, pivot, comparator);
    qsort(array, pivot+1, end, comparator);
  }
}

Array.prototype.STD_COMPARATOR = function(a,b) {
  if (b>a) return 1;
  if (a==b) return 0;
  return -1;
}

Array.prototype.sort = function(comparator) {
  if (!comparator) comparator = Array.prototype.STD_COMPARATOR;
  
  qsort(this, 0, this.length, comparator);
}