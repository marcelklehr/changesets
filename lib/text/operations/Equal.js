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
 * Equal Operation
 * Defined by:
 * @param accessory <Number> Something that breaks the tie (should be different for every editor/source); optional
 */
function Equal(accessory) {
  this.accessory = accessory || 0
}

// True inheritance
Equal.prototype = Object.create(Operation.prototype, {
  constructor: {
    value: Equal,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Equal

Equal.prototype.transformAgainst = function() {
  return this
}

Equal.prototype.substract = function() {
  return this
}

Equal.prototype.invert = function() {
  return this
}

Equal.prototype.apply = function(text) {
  return text
}