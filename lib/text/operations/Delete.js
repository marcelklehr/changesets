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
 * Delete Operation
 * Defined by:
 * @param pos <Number> The character index in the text at which the string should be inserted
 * @param text <String> The string to be inserted
 * @param accessory <Number> Something that breaks the tie (should be different for every editor/source); optional
 */
function Delete(initialLength, pos, text, accessory) {
  this.initialLength = initialLength
  this.accessory = accessory || 0
  this.pos = pos|0
  this.len = text.length
  this.text = text
}

// True inheritance
Delete.prototype = Object.create(Operation.prototype, {
  constructor: {
    value: Delete,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Delete


var Insert = require('./Insert')
  , Equal = require('./Equal')
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
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms the current operation against another operation in such a way
 * that the impact of the latter is effectively excluded
 */
Delete.prototype.substract = function(change) {
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
Delete.prototype.invert = function() {
  return new Insert(this.initialLength-this.len, this.pos, this.text, this.accessory)
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Delete.prototype.apply = function(text) {
  if(text.length != this.initialLength) throw new Error('Text length doesn\'t match expected length. It\'s most likely you have missed a transformation: expected:'+this.initialLength+', actual:'+text.length)
  if(text.substr(this.pos, this.len) != this.text) throw new Error('Applying delete operation: Passed context doesn\'t match assumed context: '+JSON.stringify(this)+', actual context: "'+text.substr(this.pos, this.len)+'"')
  return text.slice(0, this.pos) + text.slice(this.pos+this.len)
}
