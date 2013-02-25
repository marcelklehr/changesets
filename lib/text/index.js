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

var Changeset = require('./Changeset')
  , Delete = require('./operations/Delete')
  , Insert = require('./operations/Insert')
  , dmp = require('diff_match_patch')
  , engine = new dmp.diff_match_patch

// Don't optimize time if diffs become less optimal
engine.Diff_Timeout = 0

exports.Changeset = Changeset
exports.Insert = Insert
exports.Delete = Delete
  
/**
 * Returns a Changeset containing the operations needed to transform text1 into text2
 * 
 * @param text1 <String>
 * @param text2 <String>
 * @param accessory <Number> tie breaker; optional (only necessary in a distributed environment, should be different for every editor/source)
 */
exports.constructChangeset = function(text1, text2, accessory) {
  accessory = accessory || 0
  var diff = engine.diff_main(text1, text2, /* checkLines: */ false)
  //engine.diff_cleanupEfficiency(diff)
  
  var i = 0
    , cs = new Changeset
    , initialLength = text1.length
  diff.forEach(function(d) {
    if (dmp.DIFF_DELETE == d[0]) {
      cs.push(new Delete(initialLength, i, d[1], accessory))
      i += d[1].length
    }
    
    if (dmp.DIFF_INSERT == d[0]) {
      cs.push(new Insert(initialLength, i, d[1], accessory))
    }
    
    if(dmp.DIFF_EQUAL == d[0])
      i += d[1].length
  })
  
  return cs
}

/**
 * Serializes the given changeset in order to return a (hopefully) more compact representation
 * that can be sent through a network or stored in a database
 * @alias cs.text.Changeset#pack
 */
exports.pack = function(cs) {
  return cs.pack()
}

/**
 * Unserializes the output of cs.text.pack
 * @alias cs.text.Changeset.unpack
 */
exports.unpack = function(packed) {
  return Changeset.unpack(packed)
}