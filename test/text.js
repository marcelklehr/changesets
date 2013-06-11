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
// Insert onto nothing
, ["123", ["1a2b3c", "123"], "1a2b3c", "Insert onto Nothing"]
]
.forEach(function(test, i) {
  var batch = {}
  batch[test[3]] = {
      topic: function() {
        var cs1 = engine.constructChangeset(test[0],test[1][0], 1)
          , cs2 = engine.constructChangeset(test[0],test[1][1], 2)

        console.log("\n\n", test[0])        
        console.dir(cs1.inspect())
        console.dir(cs2.inspect())

        cs1 = cs1.transformAgainst(cs2)
        console.log('=>', cs1.inspect())

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
, [["1234", "d2bc", "da2abc"], "1234aa", "Mixed ET 2"]// yea. this is because of using cleanup_efficiency
]
.forEach(function(test, i) {
  var batch = {}
  batch[test[2]] = {
      topic: function() {
        var cs1 = engine.constructChangeset(test[0][0],test[0][1], 1)
          , cs2 = engine.constructChangeset(test[0][1],test[0][2], 2)

        console.log("\n\n "+test[0][0]+":", test[0][2], '-', test[0][1])
        console.dir(cs1.inspect())
        console.dir(cs2.inspect())

        cs2 = cs2.substract(cs1)
        console.log('=>', cs2.inspect())

        return cs2.apply(test[0][0])
      },
      'should be correctly transformed using exclusion transformation': function(err, text) {
        assert.ifError(err)
        assert.equal(test[1], text)
      }
    }
  suite.addBatch(batch)
})

suite.addBatch({
'pack/unpack':
  { topic: function() {
      return engine.constructChangeset("1234blabliblu", "1ab2c3blablakablibradalu")
    }
  , 'should be packed and unpacked correctly': function(er, cs) {
      var packed = cs.pack()
      console.log()
      console.log(cs.inspect())
      console.log(packed)
      var unpacked = engine.Changeset.unpack(packed)
      assert.deepEqual(unpacked, cs)
    }
  }
})

// Invert

;// Inverting Insert
[ ["123", "123b", "Insert at the end"]
, ["123", "b123", "Insert at the beginning"]
, ["123", "1b23", "Insert in the middle"]
// Inverting Delete
, ["123", "12", "Delete at the end"]
, ["123", "23", "Delete at the beginning"]
, ["123", "13", "Delete in the middle"]
// Inverting Equal
, ["123", "123", "Identity"]
]
.forEach(function(test, i) {
  var batch = {}
  batch[test[2]] = {
      topic: function() {
        var cs1 = engine.constructChangeset(test[0], test[1], 1)
          , cs2 = cs1.invert()

        console.log("\n\n "+test[0]+": inverting ", test[1])
        console.dir(cs1.inspect())
        console.dir(cs2.inspect())

        var text = cs1.apply(test[0])
        return cs2.apply(text)
      },
      'should be correctly inverted': function(err, text) {
        assert.ifError(err)
        assert.equal(test[0], text)
      }
    }
  suite.addBatch(batch)
})

suite.addBatch({
'accessories':
  { topic: function() {
      return [engine.constructChangeset("1234", "1234b", 521), engine.constructChangeset("1234", "1234a", 834)]
    }
  , 'should cause the same outcome ragardless of the transformation order': function(er, cs) {
      var text1 = cs[0].transformAgainst(cs[1]).apply( cs[1].apply("1234") )
      var text2 = cs[1].transformAgainst(cs[0]).apply( cs[0].apply("1234") )
      console.log(text1, text2)
      assert.equal(text1, text2)
    }
  , 'should be the same after packing and unpacking': function(er, cs) {
      var acc1 = cs[0][0].accessory
        , acc2 = engine.Changeset.unpack(cs[0].pack())[0].accessory
      
      console.log(acc1, acc2)
      assert.equal(acc2, acc1)
    }
  }
})

suite.addBatch({
'validation':
  { topic: function() {
      var cs = engine.constructChangeset("1234", "1234b")
      cs.apply(cs.apply("1234"))
    }
  , 'should error if you apply the same cs twice, without transforming it': function(er) {
      console.log(er)
      assert.throws(er)
    }
  }
})

suite.export(module)
