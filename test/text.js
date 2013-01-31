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

var vows = require('vows')
  , assert = require('assert')

var changesets = require('../lib')
  , engine = changesets.text


var suite = vows.describe('changesets: operational transformation of text')

// IT

;// Insert onto Insert
[ ["123", ["a123", "123b"], "a123b", "Insert onto Insert; o1.pos < o2.pos"]
, ["123", ["1a23", "1b23"], "1ab23", "Insert onto Insert; o1.pos = o2.pos"]
, ["123", ["12a3", "b123"], "b12a3", "Insert onto Insert; o2.pos < o1.pos"]
// Insert onto Delete
, ["123", ["1a23", "12"], "1a2", "Insert onto Delete; o1.pos < o2.pos"]
, ["123", ["1a23", "13"], "1a3", "Insert onto Delete; o1.pos = o2.pos"]
, ["123", ["12a3", "3"], "a3", "Insert onto Delete; o2.pos+len = o1.pos"]
, ["123", ["12a3", "23"], "2a3", "Insert onto Delete; o2.pos < o1.pos"]
, ["123", ["12a3", "1"], "1a", "Insert onto Delete; o1.pos < o2.pos+len"]
, ["123", ["12a3", ""], "a", "Insert onto Delete; o2.pos < o1 < o2.pos+len"]
// Delete onto Delete
, ["1234", ["124", "234"], "24", "Delete onto Delete; o2.pos+len < o1.pos"]
, ["1234", ["234", "124"], "24", "Delete onto Delete; o1.pos < o2.pos"]
, ["123", ["3", "13"], "3", "Delete onto Delete; something at the end of my range has already been deleted"]
, ["123", ["3", "23"], "3", "Delete onto Delete; something at the beginning of my range has already been deleted"]
, ["1234", ["4", "134"], "4", "Delete onto Delete; something in the middle of my range has already been deleted"]
, ["123", ["13", "1"], "1", "Delete onto Delete; my whole range has already been deleted ('twas at the beginning of the other change's range)"]
, ["123", ["12", "1"], "1", "Delete onto Delete; my whole range has already been deleted ('twas at the end of the other change's range)"]
, ["1234", ["134", "4"], "4", "Delete onto Delete; my whole range has already been deleted ('twas in the middle of the other change's range)"]
// Delete onto Insert
, ["123", ["23", "123b"], "23b", "Delete onto Insert; o1.pos+len < o2.pos"]
, ["123", ["3", "1b23"], "b3", "Delete onto Insert; o1.pos < o2.pos < o2.pos+len < o1.pos+len"]
, ["123", ["13", "1b23"], "1b3", "Delete onto Insert; o1.pos = o2.pos , o1.len = o2.len"]
, ["123", ["1", "1b23"], "1b", "Delete onto Insert; o1.pos = o2.pos, o2.len < o1.len"]
, ["123", ["1", "1bbb23"], "1bbb", "Delete onto Insert; o1.pos = o2.pos, o1.len < o2.len"]
, ["123", ["12", "b123"], "b12", "Delete onto Insert; o2.pos+len < o1.pos"]
]
.forEach(function(test, i) {
  var batch = {}
  batch[test[3]] = {
      topic: function() {
        var cs1 = engine.constructChangeset(test[0],test[1][0], 1)
          , cs2 = engine.constructChangeset(test[0],test[1][1], 2)

        console.log("\n\n", test[0])        
        console.dir(cs1.dump())
        console.dir(cs2.dump())

        cs1 = cs1.transformAgainst(cs2)
        console.log('=>', cs1.dump())

        return cs1.apply(cs2.apply(test[0]))
      },
      'should be correctly transformed using inclusion transformation': function(err, text) {
        assert.ifError(err)
        assert.equal(test[2], text)
      }
    }
  suite.addBatch(batch)
})

// ET

;// Insert minus Insert
[ [["123", "123b", "a123b"], "a123", "Insert minus Insert; o2.pos < o1.pos"]
, [["123", "b123", "b12a3"], "12a3", "Insert minus Insert; o1.pos < o2.pos"]
, [["123", "bb123", "bab123"], "a123", "Insert minus Insert; o1.pos < o2.pos < o1.pos+len"]
// Insert minus Delete
, [["1234", "124", "a124"], "a1234", "Insert minus Delete; o2.pos < o1.pos"]
, [["1234", "134", "1a34"], "12a34", "Insert minus Delete; o2.pos = o1.pos"]
, [["1234", "34", "3a4"], "123a4", "Insert minus Delete; o1.pos < o2.pos"]
// Delete minus Insert
, [["123", "a123", "a13"], "13", "Delete minus Insert; o1.pos < o2.pos"]
, [["123", "123a", "13a"], "13", "Delete minus Insert; o2.pos < o1.pos"]
, [["1234", "12a34", "14"], "14", "Delete minus Insert; o2.pos < o1.pos < o2.pos+len"]
, [["123", "12abc3", "12ac3"], "123", "Delete minus Insert;  o1.pos < o2.pos < o2.pos+len < o1.pos+len"]
// Delete minus Delete
, [["1234", "34", "4"], "124", "Delete minus Delete; o1.pos < o2.pos"]
, [["1234", "123", "23"], "234", "Delete minus Delete; o2.pos < o1.pos"]
, [["1234", "123", "12"], "124", "Delete minus Delete; o2.pos < o1.pos"]
// Mixed ET
, [["1234", "2bc3", "2abc3"], "12a34", "Mixed ET 1"]
, [["1234", "d2bc", "da2abc"], "1a234a", "Mixed ET 2"]
]
.forEach(function(test, i) {
  var batch = {}
  batch[test[2]] = {
      topic: function() {
        var cs1 = engine.constructChangeset(test[0][0],test[0][1], 1)
          , cs2 = engine.constructChangeset(test[0][1],test[0][2], 2)

        console.log("\n\n "+test[0][0]+":", test[0][2], '-', test[0][1])
        console.dir(cs1.dump())
        console.dir(cs2.dump())

        cs2 = cs2.substract(cs1)
        console.log('=>', cs2.dump())

        return cs2.apply(test[0][0])
      },
      'should be correctly transformed using exclusion transformation': function(err, text) {
        assert.ifError(err)
        assert.equal(test[1], text)
      }
    }
  suite.addBatch(batch)
})

suite.export(module)
