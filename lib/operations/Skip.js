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

var Operation = require('../Operation')

/**
 * Skip Operation
 * Defined by:
 * - length
 * - symbol
 *
 * @param length <Number> How many chars to be Skip
 */
function Skip(length) {
  this.length = length
  this.symbol = '-'
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
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(text)) == text
 */
Skip.prototype.invert = function() {
  return new Insert(this.length)
}

Skip.prototype.applyDry = function(pointers) {
  pointers.removendum += this.length
  pointers.input += this.length
  return 0
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Skip.prototype.apply = function(pointers, input, addendum) {
/*  // just a quick integrity check, if we remove the right stuff
  var removedFragment = input.substr(pointers.input, op.length)
    , removendumFragment = removendum.substr(pointers.removendum, op.length)
  if(removedFragment !== removendumFragment) throw new Error('Skip Mismatch! The removed chars don\'t equal the expected chars.')
*/
  this.applyDry(pointers)
  return ""
}
