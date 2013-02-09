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

var Changeset = require('../Changeset')
  , Delete = require('./operations/Delete')
  , Insert = require('./operations/Insert')
  , dmp = require('diff_match_patch')
  , engine = new dmp.diff_match_patch

// Don't optimize time if diffs become less optimal
engine.Diff_Timeout = 0

  
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
  diff.forEach(function(d) {
    if (dmp.DIFF_DELETE == d[0]) {
      cs.push(new Delete(i, d[1], accessory))
      i += d[1].length
    }
    
    if (dmp.DIFF_INSERT == d[0]) {
      cs.push(new Insert(i, d[1], accessory))
    }
    
    if(dmp.DIFF_EQUAL == d[0])
      i += d[1].length
  })
  
  return cs
}

/**
 * Serializes the given changeset in order to return a (hopefully) more compact representation
 * that can be sent through a network or stored in a database
 *
 * Numbers are converted to the base 36, text is converted to base64 (this is inefficient, I know..)
 *
 * @param cs <Changeset> The changeset to be serialized
 * @returns <String> The serialized changeset
 */
exports.pack = function(cs) {
  var packed = cs.map(function(op) {
    var text = (new Buffer(op.text)).toString('base64').replace(/=+/, '')
      , pos = (op.pos).toString(36)
      , accessory = (op.accessory).toString(36)

    if(op instanceof Delete) {
      return '-'+pos+':'+text+':'+accessory
    }
    if(op instanceof Insert) {
      return '+'+pos+':'+text+':'+accessory
    }
  }).join('')
  return packed
}

/**
 * Unserializes the output of cs.text.pack
 * 
 * @param packed <String> The serialized changeset
 * @param <cs.Changeset>
 */
exports.unpack = function(packed) {
  var matches = packed.match(/(\+|-)\w+?:[^:\+-]+?:\w+?/g)
  if(!matches) throw new Error('Cannot unpack invalid serialized changeset string')
  
  var cs = new Changeset
  matches.forEach(function(s) {
    var type = s.substr(0,1)
      , props = s.substr(1).split(':')
    var pos = parseInt(props[0], 36)
      , text = (new Buffer(props[1], 'base64')).toString()
      , accessory = parseInt(props[2], 36)
    if(type == '-') return cs.push(new Delete(props[0], text, props[2]))
    if(type == '+') return cs.push(new Insert(pos, text, accessory))
  })
  return cs
}