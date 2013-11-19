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

var Operator = require('../Operator')

/**
 * Skip Operator
 * Defined by:
 * - length
 * - input=length
 * - output=0
 *
 * @param length <Number> How many chars to be Skip
 */
function Skip(length) {
  this.length = length
  this.input = length
  this.output = 0
}

// True inheritance
Skip.prototype = Object.create(Operator.prototype, { 
  constructor: {
    value: Skip,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Skip
Skip.prototype.symbol = '-'

var Insert = require('./Insert')
  , Retain = require('./Retain')
  , Changeset = require('../Changeset')

Skip.prototype.apply = function(t) {
  var input = t.readInput(this.input)
  t.writeRemovendum(input)
  t.writeOutput(t.subrange(input, 0, this.output)) // retain Inserts in my range
}

Skip.prototype.merge = function(op2) {
  return this
}

Skip.prototype.invert = function() {
  return new Insert(this.length)
}

Skip.unpack = function(data) {
  return new Skip(parseInt(data, 36))
}