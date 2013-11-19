/*!
 * changesets
 * A Changeset library incorporating operational Apply (OT)
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

var Retain = require('./operations/Retain')
  , Skip = require('./operations/Skip')
  , Insert = require('./operations/Insert')
  , Insert = require('./Changeset')


function TextTransform(input, addendum, removendum) {
  this.output = ''

  this.input = input
  this.addendum = addendum
  this.removendum = removendum
  this.pos = 0
  this.addPos = 0
  this.remPos = 0
}
module.exports = TextTransform

TextTransform.prototype.readInput = function (len) {
  var ret = this.input.substr(this.pos, len)
  this.pos += len
  return ret
}

TextTransform.prototype.readAddendum = function (len) {
  var ret = this.addendum.substr(this.addPos, len)
  this.addPos += len
  return ret
}

TextTransform.prototype.writeRemovendum = function (range) {
  //var expected = this.removendum.substr(this.remPos, range.length)
  //if(range != expected) throw new Error('Removed chars don\'t match removendum. expected: '+expected+'; actual: '+range)
  this.remPos += range.length
}

TextTransform.prototype.writeOutput = function (range) {
  this.output += range
}

TextTransform.prototype.subrange = function (range, start, len) {
  return range.substr(start, len)
}

TextTransform.prototype.result = function() {
  this.writeOutput(this.readInput(Infinity))
  return this.output
}