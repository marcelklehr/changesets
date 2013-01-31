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

var Equal = require('./text/operations/Equal')

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
Changeset.prototype.dump = function() {
  return this.map(function(op) {
    return op.__proto__.constructor.name+' '+op.pos+':'+op.text
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
