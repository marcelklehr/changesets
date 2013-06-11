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

var Operation = require('../../Operation')

/**
 * Insert Operation
 * Defined by:
 * @param pos <Number> The character index in the text at which the string should be inserted
 * @param text <String> The string to be inserted
 * @param accessory <Number> Something that breaks the tie (should be different for every editor/source); optional
 */
function Insert(initialLength, pos, text, accessory) {
  this.initialLength = initialLength
  this.accessory = accessory || 0
  this.pos = pos
  this.len = text.length
  this.text = text
}

// True inheritance
Insert.prototype = Object.create(Operation.prototype, {
  constructor: {
    value: Insert,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Insert

var Delete = require('./Delete')
  , Equal = require('./Equal')

/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the current operation against another operation in such
 * a way that the impact of the latter is effectively included
 */
Insert.prototype.transformAgainst = function(change) {
  // Insert
  if (change instanceof Insert) {
    var newInitialLength = this.initialLength+change.len
    // 'abc' =>  0:+x('xabc') | 3:+x('abcx')
    // 'xabcx'
    if (this.pos < change.pos) {
      return new Insert(newInitialLength, this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>   1:+x('axbc') | 1:+y('aybc')
    // 'ayxbc'  -- depends on the accessory (the tie breaker)
    if (this.pos == change.pos && this.accessory < change.accessory) {
      return new Insert(newInitialLength, this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>   1:+x('axbc') | 0:+x('xabc')
    // 'xaxbc'
    if (change.pos <= this.pos) {
      return new Insert(newInitialLength, this.pos+change.len, this.text, this.accessory)
    }
  }

  // Delete
  if (change instanceof Delete) {
    var newInitialLength = this.initialLength-change.len
    
    // 'abc'=>  1:+x('axbc') | 2:-1('ab')
    // 'axb'
    if (this.pos < change.pos) {
      return new Insert(newInitialLength, this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>  1:+x('axbc') | 1:-1('ac')
    // 'axb'
    if (this.pos == change.pos) {
      return new Insert(newInitialLength, this.pos, this.text, this.accessory)
    }
    
    //'abc'=> 2:+x('abxc') | 0:-2('c')
    //'xc'
    if (change.pos < this.pos) {
      // Shift this back by `change.len`, but not more than `change.pos`
      return new Insert(newInitialLength, Math.max(this.pos - change.len, change.pos), this.text, this.accessory)
    }
  }
  
  // Equal
  if(change instanceof Equal) return this
  
  throw new Error('Invalid value supplied to Insert#transformAgainst(); expected #<changesets.Operation>, but got #<'+change.__proto__.constructor.name+'>')
}

/**
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms the current operation against another operation in such a way
 * that the impact of the latter is effectively excluded
 */
Insert.prototype.substract = function(change) {
  // The current operation already assumes that
  // the other `change` happened, so we create an operation
  // that undoes the effect of `change` and transform the
  // current operation on top of the inverse `change`
  return this.transformAgainst(change.invert())
}

/**
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(text)) == text
 */
Insert.prototype.invert = function() {
  return new Delete(this.initialLength+this.len, this.pos, this.text, this.accessory)
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Insert.prototype.apply = function(text) {
  if(text.length != this.initialLength) throw new Error('Text length doesn\'t match expected length. It\'s most likely you have missed a transformation: expected:'+this.initialLength+', actual:'+text.length)
  return text.slice(0, this.pos) + this.text + text.slice(this.pos)
}
