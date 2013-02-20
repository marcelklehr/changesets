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
 * A list (in no particular order) of context-equivalent operations
 * (use Changeset#sequencify() to get an array of transformed
 * ops that can be applied on a document in sequence)
 *
 * @param ops.. <Operation> all passed operations will be added to the changeset
 */
function Changeset() {
  for(var i=0; i<arguments.length; i++) {
    this.push(arguments[i])
  }
}

Changeset.prototype = new Array
Changeset.prototype.constructor = Changeset
module.exports = Changeset

var Equal = require('./operations/Equal')
  , Delete = require('./operations/Delete')
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
Changeset.prototype.transformAgainst = function(changeset) {
  if(!(changeset instanceof Changeset)) {
    throw new Error('Argument must be a #<Changeset>, but received '+changeset.__proto__.constructor.name)
  }
  
  var newCs = new Changeset
    , changes = changeset.sequencify()
    
  this.forEach(function(op) {
    changes.forEach(function(o) {
      if(op instanceof Changeset) return op = op.transformAgainst(new Changeset(o))
      op = op.transformAgainst(o)
    })
    newCs.push(op)
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
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(state)) == state
 */
Changeset.prototype.apply = function(resource) {
  var changes = this.sequencify()
  changes.forEach(function(op) {
    resource = op.apply(resource)
  })
  
  return resource
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

// Hack that sorts out no-ops as well as changesets
Changeset.prototype.push = function() {
  var that = this
  for(var i=0; i < arguments.length; i++) {
    if(arguments[i] instanceof Equal) continue;
    if(arguments[i] instanceof Changeset) {
      arguments[i].forEach(function(op) {
        that.push(op)
      })
      continue;
    }
    Array.prototype.push.call(this, arguments[i])
  }
  return this
}

/**
 * Serializes the given changeset in order to return a (hopefully) more compact representation
 * that can be sent through a network or stored in a database
 *
 * Numbers are converted to the base 36, unsafe chars in the text are urlencoded
 *
 * @param cs <Changeset> The changeset to be serialized
 * @returns <String> The serialized changeset
 */
Changeset.prototype.pack = function() {
  var packed = this.map(function(op) {
    var text = op.text.replace('%', '%25').replace(':', '%3A')
      , pos = (op.pos).toString(36)
      , accessory = (op.accessory).toString(36)

    if(op instanceof Delete) {
      return '-'+pos+':'+text+':'+accessory
    }
    if(op instanceof Insert) {
      return '+'+pos+':'+text+':'+accessory
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
  var matches = packed.match(/(\+|-)\w+?:[^:]+?:\w+/g)
  if(!matches) throw new Error('Cannot unpack invalid serialized changeset string')
  
  var cs = new Changeset
  matches.forEach(function(s) {
    var type = s.substr(0,1)
      , props = s.substr(1).split(':')
    var pos = parseInt(props[0], 36)
      , text = url_decode(props[1])
      , accessory = parseInt(props[2], 36)
    if(type == '-') return cs.push(new Delete(pos, text, accessory))
    if(type == '+') return cs.push(new Insert(pos, text, accessory))
  })
  return cs
}


function url_decode(text) {
  if('undefined' != typeof window) return decodeURIComponent(text)
  return require('querystring').unescape(text)
}