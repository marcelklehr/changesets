/*!
 * changesets
 * A Changeset library incorporating operational ChangesetTransform (OT)
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
  , Changeset = require('./Changeset')


function ChangesetTransform(inputCs, addendum) {
  this.output = []
  this.addendum = addendum
  this.newRemovendum = ''
  this.newAddendum = ''

  this.cs = inputCs
  this.pos = 0
  this.addendumPointer = 0
  this.removendumPointer = 0
}
module.exports = ChangesetTransform

ChangesetTransform.prototype.readInput = function (len) {
  var ret = this.cs.subrange(this.pos, len)
  this.pos += len
  return ret
}

ChangesetTransform.prototype.readAddendum = function (len) {
  //return [new Retain(len)]
  var ret = this.subrange(this.addendum, this.addendumPointer, len)
  this.addendumPointer += len
  return ret
}

ChangesetTransform.prototype.writeRemovendum = function (range) {
  range
    .filter(function(op) {return !op.output})
    .forEach(function(op) {
      this.removendumPointer += op.length
    }.bind(this))
}

ChangesetTransform.prototype.writeOutput = function (range) {
  this.output = this.output.concat(range)
  range
    .filter(function(op) {return !op.output})
    .forEach(function(op) {
      this.newRemovendum += this.cs.removendum.substr(this.removendumPointer, op.length)
      this.removendumPointer += op.length
    }.bind(this))
}

ChangesetTransform.prototype.subrange = function (range, start, len) {
  if(len) return this.cs.subrange.call(range, start, len)
  else return range.filter(function(op){ return !op.input})
}

ChangesetTransform.prototype.result = function() {
  this.writeOutput(this.readInput(Infinity))
  var newCs = new Changeset(this.output)
  newCs.addendum = this.cs.addendum
  newCs.removendum = this.newRemovendum
  return newCs
}