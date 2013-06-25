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
 * Skip Operation
 * Defined by:
 * - length
 *
 * @param length <Number> How many chars to be deleted
 */
function Skip(length) {
  this.length = length
}

// True inheritance
Skip.prototype = Object.create(Operation.prototype, { 
  constructor: {
    value: Skip,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Skip


var Insert = require('./Insert')
  , Retain = require('./Retain')
  , Changeset = require('../Changeset')


/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the current operation against another operation in such
 * a way that the impact of the latter is effectively included
 */
Delete.prototype.transformAgainst = function(change) {
  // Delete
  if (change instanceof Delete) {
    var newInitialLength = this.initialLength-change.len

    // 'abc' =>  0:-2('c') | 1:-1('ac')
    // 'c'
    if (this.pos < change.pos) {
      // if the other operation already deleted some of the characters
      // in my range, don't delete them again!
      var startOfOther = Math.min(change.pos - this.pos, this.len)
      return new Delete(newInitialLength, this.pos, this.text.substr(0, startOfOther) + this.text.substr(startOfOther + change.len), this.accessory)
    }
    
    // 'abc'=>   1:-1('ac') | 1:-2('a')
    // 'a'
    if (this.pos == change.pos) {
      // if the other operation already deleted some the characters
      // in my range, don't delete them again!
      if (this.len <= change.len) return new Equal
      
      // the other deletion's range is shorter than mine
      return new Delete(newInitialLength, this.pos, this.text.substr(change.len), this.accessory)
    }
    
    // 'abcd'=>   2:-1('abd') | 0:-3('d')
    // 'd'
    if (change.pos < this.pos) {
      var overlap = change.pos+change.len - this.pos // overlap of `change`, starting at `this.pos`
      if(overlap >= this.len) return new Equal
      if(overlap > 0) return new Delete(newInitialLength, change.pos, this.text.substr(overlap), this.accessory)
      return new Delete(newInitialLength, this.pos-change.len, this.text, this.accessory)
    }
  }
  
  // Insert
  if (change instanceof Insert) {
    var newInitialLength = this.initialLength+change.len
    // 'abc' =>  0:-1('bc') | 3:+x('abcx')
    // 'bcx'
    if (this.pos < change.pos) {
      if(this.pos+this.len > change.pos) {
        // An insert is done within our deletion range
        // -> split it in to
        var firstHalfLength = change.pos-this.pos
        return new Changeset(
          new Delete(newInitialLength, this.pos, this.text.substr(0, firstHalfLength), this.accessory)
        , new Delete(newInitialLength, change.pos+change.len, this.text.substr(firstHalfLength), this.accessory))
      }
      return new Delete(newInitialLength, this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>   1:-1('ac') | 1:+x('axbc')
    // 'axc'
    if (this.pos == change.pos) {
      return new Delete(newInitialLength, this.pos+change.len, this.text, this.accessory)
    }
    
    // 'abc'=>   2:-1('ab') | 0:+x('xabc')
    // 'xab'
    if (change.pos < this.pos) {
      return new Delete(newInitialLength, this.pos+change.len, this.text, this.accessory)
    }
  }
  
  // Equal
  if(change instanceof Equal) return this
  
  throw new Error('Invalid value supplied to Insert#transformAgainst(); expected #<changesets.Operation>, but got #<'+change.__proto__.constructor.name+'>')
}

/**
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(text)) == text
 */
Skip.prototype.invert = function() {
  return new Insert(this.length)
}

Skip.prototype.applyDry = function(pointers) {
  pointers.input += op.length
  return 0
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Skip.prototype.apply = function(pointers, input, addendum, removendum) {
  // just a quick integrity check, if we remove the right stuff
  var removedFragment = input.substr(pointers.input, op.length)
    , removendumFragment = removendum.substr(pointers.removendum, op.length)
  if(removedFragment !== removendumFragment) throw new Error('Delete Mismatch! The removed chars don\'t equal the expected chars.')

  this.applyDry(pointers)
  return ""
}
