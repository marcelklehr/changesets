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
 * Mark Operation (a retain with attributes)
 * Defined by:
 * - length
 * - symbol
 * - input=output=length
 *
 * @param length <Number> How many chars to Mark
 * @param attribs <Object> A set of numbers that refer to attributes, if the number is positive the attribute is added, if negative, the attribute is removed.
 */
function Mark(length, attribs) {
  this.length = length
  this.input = length
  this.output = length
  this.attribs = attribs || {}
  this.symbol = '*'
}

var Retain = require('./Retain')

// True inheritance
Mark.prototype = Object.create(Retain.prototype, {
  constructor: {
    value: Mark,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Mark

Mark.prototype.merge = function(op2) {
    var newop = new Mark(this.length)
    if(op2.attribs) Object.keys(op2.attribs).forEach(function(a) {
      newop[a] = 1
    })
    Object.keys(this.attribs).forEach(function(a) {
      newop[a] = 1
      
      // add and remove annihilate each other
      if(newop[-a]) {
        delete newop[-a]
        delete newop[a]
      }
    })
    return newop
  }else return Retain.prototype.merge.apply(this, arguments)
}

Mark.unpack = function(data) {
  data = data.split('*').map(function(i) {parseInt(i, 36)})
  var length = data.shift()
    , attribs = {}
  
  data.forEach(function(a) {
    attribs[a] = 1
  })
  
  return new Mark(length, attribs)
}