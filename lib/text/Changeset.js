/*!
 * changesets
 * A Changeset library incorporating operational transformation (OT)
 * Copyright 2012 by Marcel Klehr <mklehr@gmx.net>
 *
 * (MIT LICENSE)
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * A sequence of consecutive operations
 *
 * @param ops.. <Operation> all passed operations will be added to the changeset
 */
function Changeset() {
  for(var i=0; i<arguments.length; i++) {
    this.push(arguments[i])
  }
  this.addendum = ""
  this.removendum = ""
}

// True inheritance
Changeset.prototype = Object.create(Array.prototype, {
  constructor: {
    value: Changeset,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Changeset

var Retain = require('./operations/Retain')
  , Skip = require('./operations/Skip')
  , Insert = require('./operations/Insert')

/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the operations of the current changeset against the
 * all operations in another changeset in such a way that the
 * impact of the latter are effectively included
 * 
 * @returns <Changeset>
 */
Changeset.prototype.transformAgainst = function(otherCs) {
  if(!(otherCs instanceof Changeset)) {
    throw new Error('Argument must be a #<Changeset>, but received '+otherCs.__proto__.constructor.name)
  }
  
  var newCs = new Changeset
    , csPointer = 0 // index that represents chars of the other cs's input
    , inputPointer = 0 // index that represents chars of this cs's input
    
  
  // overtake addendum
  newCs.addendum = this.addendum
  
  // Operated on by this cs's ops
  // indices represent chars of an assumed input that this cs is applied on
  // (the output of the other cs)
  var inputPointers = {
    addendum: 0
  , input: 0
  }
  
  // operated on by the other cs's ops
  // indices represent removed/retained chars in the other cs
  // (the input of the other cs; we don't use these! we only use the output of applyDry())
  var csPointers = {
    addendum: 0
  , input: 0
  }
  
  var opstack = this.slice(0)
  
  // "apply" all ops of the other cs on this cs, while letting all inserts of this cs live

  otherCs.forEach(function(op) {
    var retainLen = op.applyDry(csPointers) // apply the other cs on this cs's input
      , skipLen = csPointers.input - csPointer
      , insertLen = csPointer+retainLen - csPointers.input
      , range = 0
    
    if(op instanceof Insert) {// just push a retain with that length
      newCs.push(new Retain(insertLen))
      return
    }
    
    range = op.length
    csPointer += range // Move outputPointer
    
    // copies all ops in the range (ignoring inserts in the inputPointer) and slices the last one, if it doesn't fit neatly
    var thisOp
    while(opstack.length && (opstack[0] instanceof Insert || inputPointers.input+opstack[0].length <= inputPointer+range)) {// iterate through all outstanding ops of this cs
      thisOp = opstack.shift()// get the next op in this (!) line
      if(op instanceof Retain || thisOp instanceof Insert) newCs.push(thisOp)
      if(thisOp instanceof Skip) newCs.removendum += this.removendum.substr(inputPointers.removendum, thisOp.length)
      thisOp.applyDry(inputPointers) // only Retain and Delete increase .input pointer
    }

    if(inputPointer+range > inputPointers.input) { // there's an op left that we need to slice
      if(!opstack.length) throw new Error('WUT!? no more ops on stack!')
      thisOp = opstack[0]
      var slicedOp = thisOp.clone()
      slicedOp.length = inputPointer+range - inputPointers.input

      if(slicedOp instanceof Skip) newCs.removendum += this.removendum.substr(inputPointers.removendum, slicedOp.length)
      slicedOp.applyDry(inputPointers) // add one half to the new cs
      if(op instanceof Retain) newCs.push(slicedOp)

      thisOp.length = thisOp.length - slicedOp.length // return the other half to the stack
    }
    
    if(op instanceof Skip) inputPointers.input -= skipLen // sync input and ouput pointers, since we just skipped the deletions (that came from otherCs)
    if(op instanceof Retain) inputPointer = inputPointers.input // Move outputPointer
  }.bind(this))
  
  opstack.forEach(function(thisOp){
    newCs.push(thisOp)
  })
  
  return newCs
}

/**
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms all operations in the current changeset against the operations
 * in another changeset in such a way that the impact of the latter are effectively excluded
 * 
 * @returns <Changeset>
 */
Changeset.prototype.substract = function(changeset) {
  // The current operations assume that the changes in
  // `changeset` happened before, so for each of those ops
  // we create an operation that undoes its effect and
  // transform all our operations on top of the inverse changes
  return this.transformAgainst(changeset.invert())
}

/**
 * Returns the inverse Changeset of the current one
 * 
 * Changeset.invert().apply(Changeset.apply(document)) == document
 */
Changeset.prototype.invert = function() {
  var newCs = new Changeset
  var addendum = this.addendum
  this.addendum = this.removendum
  this.removendum = addendum
  this.forEach(function(op) {
    newCs.push(op.invert())
  })
  return newCs
}

/**
 * Applies this changeset on a text
 */
Changeset.prototype.apply = function(input) {
  var pointers = {
    addendum: 0
  , input: 0
  }
  var output = ""

  this.forEach(function(op) {
    // each Operation has access to all pointers as well as the input, addendum and removendum (the latter are immutable)
    output += op.apply(pointers, input, this.addendum)
  }.bind(this))
  
  return output
}

/**
 * Returns an array of strings describing this changeset's operations
 */
Changeset.prototype.inspect = function() {
  var j = 0
  return this.map(function(op) {
    var string = ''

    if(op instanceof Insert) {
      string = this.addendum.substr(j,op.length)
      j += op.length
      return string
    }
    
    for(var i=0; i<op.length; i++) string += op.symbol
    return string
  }.bind(this)).join('')
}

/**
 * Serializes the given changeset in order to return a (hopefully) more compact representation
 * than json that can be sent through a network or stored in a database
 *
 * Numbers are converted to the base 36, unsafe chars in the text are urlencoded
 *
 * @param cs <Changeset> The changeset to be serialized
 * @returns <String> The serialized changeset
 */
Changeset.prototype.pack = function() {
  var packed = this.map(function(op) {
    return op.symbol+(op.length).toString(36)
  }).join('')
  
  var addendum = this.addendum.replace(/%/g, '%25').replace(/\|/g, '%7C')
    , removendum = this.removendum.replace(/%/g, '%25').replace(/\|/g, '%7C')
  return packed+'|'+addendum+'|'+removendum
}
Changeset.prototype.toString = function() {
  return this.pack()
}

/**
 * Unserializes the output of cs.text.Changeset#toString()
 * 
 * @param packed <String> The serialized changeset
 * @param <cs.Changeset>
 */
Changeset.unpack = function(packed) {
  if(packed == '') throw new Error('Cannot unpack from empty string')
  var components = packed.split('|')
    , opstring = components[0]
    , addendum = components[1].replace(/%7c/gi, '|').replace(/%25/g, '%')
    , removendum = components[2].replace(/%7c/gi, '|').replace(/%25/g, '%')

  var matches = packed.match(/(\+|-|=)\w+?/g)
  if(!matches) throw new Error('Cannot unpack invalid serialized op string')
  
  var cs = new Changeset
  cs.addendum = addendum
  cs.removendum = removendum
  
  matches.forEach(function(s) {
    var symbol = s.substr(0,1)
      , length = parseInt(s.substr(1), 36)
    if('-' == symbol) return cs.push(new Skip(length))
    if('+' == symbol) return cs.push(new Insert(length))
    if('=' == symbol) return cs.push(new Retain(length))
  })
  return cs
}