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
 * Insert Operation
 * Defined by:
 * - length
 * - symbol
 *
 * @param length <Number> How many chars to be inserted
 */
function Insert(length) {
  this.length = length
  this.symbol = '+'
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

var Skip = require('./Skip')
  , Retain = require('./Retain')

/**
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(text)) == text
 */
Insert.prototype.invert = function() {
  return new Skip(this.length)
}

Insert.prototype.applyDry = function(pointers) {
  pointers.addendum += this.length
  return this.length
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Insert.prototype.apply = function(pointers, input, addendum, removendum) {
  return addendum.substr(pointers.addendum, this.applyDry(pointers))
}


Insert.unpack = function(data) {
  return new Insert(parseInt(data, 36))
}