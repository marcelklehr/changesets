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

var dmp = require('diff_match_patch')
  , engine = new dmp.diff_match_patch

// Don't optimize time if diffs become less optimal
engine.Diff_Timeout = 0

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
  this.initialLength = 0
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

  
Changeset.prototype.push = function(op) {
  if(op instanceof Retain || op instanceof Skip) this.initialLength += op.length
  return Array.prototype.push.apply(this, arguments)
}

/**
 * Merge two changesets (that are based on the same state!) so that the resulting changseset
 * has the same effect as both orignal ones applied one after the other
 *
 * @param otherCs <Changeset>
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely))
 * @returns <Changeset>
 */
Changeset.prototype.merge = function(otherCs, left) {
  if(!(otherCs instanceof Changeset)) {
    throw new Error('Argument must be a #<Changeset>, but received '+otherCs.__proto__.constructor.name)
  }
  
  var newCs = new Changeset
    , pointers1 = {
        addendum: 0
      , removendum: 0
      , input: 0
      }
    , pointers2 = {
        addendum: 0
      , removendum: 0
      , input: 0
      }
  
  zip(this, otherCs, function(op1, op2) {
    // console.log(newCs.inspect())
    // console.log(op1, op2)

    if(op1 instanceof Insert && (!(op2 instanceof Insert) || left)) { // if it's a tie -- "left" breaks it.
      newCs.push(new Insert(op1.length))
      newCs.addendum += this.addendum.substr(pointers1.addendum, op1.length) // overtake added chars
      op1.applyDry(pointers1)
      op1.length = 0 // don't gimme that one again.
      return
    }
    
    if(op2 instanceof Insert && (!(op1 instanceof Insert) || !left)) {// if it's a tie -- "left" breaks it.
      newCs.push(new Insert(op2.length))
      newCs.addendum += otherCs.addendum.substr(pointers2.addendum, op2.length) // overtake added chars
      op2.applyDry(pointers2)
      op2.length = 0 // don't gimme that one again.
      return
    }
    
    if(op2 instanceof Skip) {
      newCs.push(new Skip(op2.length))
      newCs.removendum += otherCs.removendum.substr(pointers2.removendum, op2.length) // overtake removed chars
      op2.applyDry(pointers2)
      if(op1) op1.length = 0 // don't gimme these again.
      op2.length = 0
      return
    }
    
    if(op1 instanceof Skip) {
      newCs.push(new Skip(op1.length))
      newCs.removendum += this.removendum.substr(pointers1.removendum, op1.length) // overtake removed chars
      op1.applyDry(pointers1)
      op1.length = 0 // don't gimme that one again.
      if(op2) op2.length = 0
      return
    }
    
    if(op1 instanceof Retain) {
      newCs.push(new Retain(op1.length))
      op1.length = 0 // don't gimme these again.
      if(op2) op2.length = 0
      return
    }
    
    console.log('oops')
    throw new Error('oops. This case hasn\'t been considered by the developer (error code: PBCAC)')
  }.bind(this))
  
  return newCs
}

/**
 * A private and quite handy function that slices ops into equally long pieces and applies them on a mapping function
 * that can determine the iteration steps by setting op.length to 0 on an op (equals using .next() in a usual iterator)
 */
function zip(cs1, cs2, func) {
  var opstack1 = cs1.map(function(op) {return op.clone()}) // copy ops
    , opstack2 = cs2.map(function(op) {return op.clone()})
  
  var op2, op1
  while(opstack1.length || opstack2.length) {// iterate through all outstanding ops of this cs
    op1 = opstack1[0]? opstack1[0].clone() : null
    op2 = opstack2[0]? opstack2[0].clone() : null
    
    if(op1) {
      if(op2) op1.length = Math.min(op1.length, op2.length) // slice 'em into equally long pieces
      if(opstack1[0].length > op1.length) opstack1[0].length -= op1.length
      else opstack1.shift()
    }
    
    if(op2) {
      if(op1) op2.length = Math.min(op1.length, op2.length) // slice 'em into equally long pieces
      if(opstack2[0].length > op2.length) opstack2[0].length -= op2.length
      else opstack2.shift()
    }

    func(op1, op2)
    
    if(op1 && op1.length) opstack1.unshift(op1)
    if(op2 && op2.length) opstack2.unshift(op2)
  }
}


/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the operations of the current changeset against the
 * all operations in another changeset in such a way that the
 * effects of the latter are effectively included
 * 
 * @param otherCs <Changeset>
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely)
 * 
 * @returns <Changeset>
 */
Changeset.prototype.transformAgainst = function(otherCs, left) {
  if(!(otherCs instanceof Changeset)) {
    throw new Error('Argument must be a #<Changeset>, but received '+otherCs.__proto__.constructor.name)
  }
  
  var newCs = new Changeset
    , pointers = {
        addendum: 0
      , removendum: 0
      , input: 0
      }
  
  // overtake addendum
  newCs.addendum = this.addendum
  
  zip(this, otherCs, function(op1, op2) {
    // console.log(newCs.inspect())
    // console.log(op1, op2)
    
    if(op1 instanceof Insert && (!(op2 instanceof Insert) || left)) {// if it's a tie -- "left" breaks it.
      newCs.push(new Insert(op1.length))
      op1.length = 0 // don't gimme that one again.
      return
    }
    
    if(op2 instanceof Insert && (!(op1 instanceof Insert) || !left)) {// if it's a tie -- "left" breaks it.
      newCs.push(new Retain(op2.length))
      op2.length = 0 // don't gimme that one again.
      return
    }
    
    if(op2 instanceof Skip) {
      // don't overtake op1
      if(op1 instanceof Skip) op1.applyDry(pointers) // also, don't overtake removed chars
      if(op1) op1.length = 0 // don't gimme these again.
      op2.length = 0
      return
    }
    
    if(op1 instanceof Skip) {
      newCs.push(new Skip(op1.length))
      newCs.removendum += this.removendum.substr(pointers.removendum, op1.length) // overtake removed chars
      op1.applyDry(pointers)
      op1.length = 0 // don't gimme that one again.
      if(op2) op2.length = 0
      return
    }
    
    if(op1 instanceof Retain) {
      newCs.push(new Retain(op1.length))
      op1.length = 0 // don't gimme these again.
      if(op2) op2.length = 0
      return
    }
    
    console.log('oops')
    throw new Error('oops. This case hasn\'t been considered by the developer (error code: PBCAC)')
  }.bind(this))
  
  return newCs
}

/**
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms all operations in the current changeset against the operations
 * in another changeset in such a way that the impact of the latter are effectively excluded
 *
 * @param changeset <Changeset> the changeset to substract from this one
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely)
 * @returns <Changeset>
 */
Changeset.prototype.substract = function(changeset, left) {
  // The current operations assume that the changes in
  // `changeset` happened before, so for each of those ops
  // we create an operation that undoes its effect and
  // transform all our operations on top of the inverse changes
  return this.transformAgainst(changeset.invert(), left)
}

/**
 * Returns the inverse Changeset of the current one
 * 
 * Changeset.invert().apply(Changeset.apply(document)) == document
 */
Changeset.prototype.invert = function() {
  var newCs = new Changeset
  
  // removendum becomes addendum and vice versa
  newCs.addendum = this.removendum
  newCs.removendum = this.addendum
  
  // invert all ops
  this.forEach(function(op) {
    newCs.push(op.invert())
  })

  return newCs
}

/**
 * Applies this changeset on a text
 */
Changeset.prototype.apply = function(input) {
  // pre-requisites
  if(input.length != this.initialLength) throw new Error('Input length doesn\'t match expected length.')
  
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
    return op.pack()
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

  var matches = opstring.match(/[=+-]([^=+-])+/g)
  if(!matches) throw new Error('Cannot unpack invalid serialized op string')
  
  var cs = new Changeset
  cs.addendum = addendum
  cs.removendum = removendum
  
  matches.forEach(function(s) {
    var symbol = s.substr(0,1)
      , data = s.substr(1)
    if('-' == symbol) return cs.push(Skip.unpack(data))
    if('+' == symbol) return cs.push(Insert.unpack(data))
    if('=' == symbol) return cs.push(Retain.unpack(data))
  })
  return cs
}

/**
 * Returns a Changeset containing the operations needed to transform text1 into text2
 * 
 * @param text1 <String>
 * @param text2 <String>
 */
Changeset.fromDiff = function(text1, text2) {
  var diff = engine.diff_main(text1, text2, /* checkLines: */ false)
  engine.diff_cleanupEfficiency(diff)
  
  var cs = new Changeset // TODO: add in initial length prop
  diff.forEach(function(d) {
    if (dmp.DIFF_DELETE == d[0]) {
      cs.push(new Skip(d[1].length))
      cs.removendum += d[1]
    }
    
    if (dmp.DIFF_INSERT == d[0]) {
      cs.push(new Insert(d[1].length))
      cs.addendum += d[1]
    }
    
    if(dmp.DIFF_EQUAL == d[0]) {
      cs.push(new Retain(d[1].length))
    }
  })
  
  return cs
}