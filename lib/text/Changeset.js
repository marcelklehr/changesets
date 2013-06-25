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
    , outputPointer = 0 // index that represents chars of the other cs's output
  
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
    outputPointer += retainLen
    
    // copies all ops in the retained range (ignoring inserts in the inputPointer) and slices the last one, if it doesn't fit neatly
    if(retainLen) {
      var thisOp
      while(opstack.length && inputPointers.input+opstack[0].length <= outputPointer) {// iterate through all outstanding ops of this cs
        thisOp = opstack.shift()// get the next op in this (!) line
        newCs.push(thisOp)
        thisOp.applyDry(inputPointers) // only Retain and Insert increase .input pointer
      }
      if(outputPointer > inputPointers.input) { // there's an op left that we need to slice
        var slicedOp = thisOp.clone()
        slicedOp.length = outputPointer - inputPointers.input

        slicedOp.applyDry(inputPointers) // add one half to the new cs
        newCs.push(slicedOp)

        thisOp.length = thisOp.length - slicedOp.length // return the other half to the stack
        opstack.unshift(thisOp)
      }
      
    }
    else {
      var skipLen = csPointers.input - outputPointer
      while(opstack.length && inputPointers.input+opstack[0].length <= outputPointer+skipLen) {// iterate through all outstanding ops of this cs
        thisOp = opstack.shift()// get the next op in this (!) line
        thisOp.applyDry(inputPointers) // only Retain and Insert increase .input pointer
      }
      
      if(outputPointer > inputPointers.input) { // there's an op left that we need to slice
        var slicedOp = thisOp.clone()
        slicedOp.length = outputPointer - inputPointers.input

        slicedOp.applyDry(inputPointers) // skip one half to the new cs

        thisOp.length = thisOp.length - slicedOp.length // return the other half to the stack
        opstack.unshift(thisOp)
      }
      
      inputPointers.input -= skipLen // sync input and ouput pointers, since we just skipped the deletions (that came from otherCs)
    }
  }.bind(this))
  
  return newCs
}

Changeset.prototype.findOpAt = function(offset) {
  var index = 0
    , op
  for(var i=0; i < this.length && index+op.length < offset; i++) {
    index += op.length
    op = this[i]
  }
  
  return op
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
  var changes = Changeset.prototype.invert.apply(changeset.sequencify())
  return this.transformAgainst(changes)
}

/**
 * Transforms all contained operations against each
 * other in sequence and returns an array of those new operations
 *
 * @returns <Array>
 * Used internally
 */
Changeset.prototype.sequencify = function() {
  var result = []
  this.forEach(function(op) {
    if(op instanceof Equal) return
    
    // transform against all previous ops
    result.forEach(function(o) {
      //console.log(op.__proto__.constructor.name+' '+op.pos+':'+op.text, '->',o.__proto__.constructor.name+' '+o.pos+':'+o.text)
      op = op.transformAgainst(o)
    })
    //console.log('=',op.__proto__.constructor.name+' '+op.pos+':'+op.text)
    //  console.log()
    // ... and add it on top of them
    result.push(op)
  })
  return result
}

/**
 * Returns the inverse Changeset of the current one
 * 
 * Changeset.invert().apply(Changeset.apply(document)) == document
 */
Changeset.prototype.invert = function() {
  var newCs = new Changeset
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
  return this.map(function(op) {
    if(op.__proto__) return op.__proto__.constructor.name+' '+op.pos+':'+op.text
    return (op instanceof Insert? 'Insert' : 'Delete')+' '+op.pos+':'+op.text
  })
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
    var text = op.text.replace(/%/g, '%25').replace(/:/g, '%3A')
      , pos = (op.pos).toString(36)
      , initialLength = (op.initialLength).toString(36)
      , accessory = (op.accessory).toString(36)

    if(op instanceof Delete) {
      return '-'+pos+':'+initialLength+':'+text+':'+accessory
    }
    if(op instanceof Insert) {
      return '+'+pos+':'+initialLength+':'+text+':'+accessory
    }
  }).join('')
  return packed
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
  if(packed == '') return new Changeset
  var matches = packed.match(/(\+|-)\w+?:\w+?:[^:]+?:\w+/g)
  if(!matches) throw new Error('Cannot unpack invalid serialized changeset string')
  
  var cs = new Changeset
  matches.forEach(function(s) {
    var type = s.substr(0,1)
      , props = s.substr(1).split(':')
    var pos = parseInt(props[0], 36)
      , initialLength = parseInt(props[1], 36)
      , text = props[2].replace(/%3A/gi, ':').replace(/%25/g, '%')
      , accessory = parseInt(props[3], 36)
    if(type == '-') return cs.push(new Delete(initialLength, pos, text, accessory))
    if(type == '+') return cs.push(new Insert(initialLength, pos, text, accessory))
  })
  return cs
}