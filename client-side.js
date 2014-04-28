(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Changeset = require('./Changeset')
  , Retain = require('./operations/Retain')
  , Skip = require('./operations/Skip')
  , Insert = require('./operations/Insert')

function Builder() {
  this.ops = []
  this.addendum = ''
  this.removendum = ''
}

module.exports = Builder

Builder.prototype.keep =
Builder.prototype.retain = function(len) {
  this.ops.push(new Retain(len))
  return this
}

Builder.prototype.delete =
Builder.prototype.skip = function(str) {
  this.removendum += str
  this.ops.push(new Skip(str.length))
  return this
}

Builder.prototype.add =
Builder.prototype.insert = function(str) {
  this.addendum += str
  this.ops.push(new Insert(str.length))
  return this
}

Builder.prototype.end = function() {
  var cs = new Changeset(this.ops)
  cs.addendum = this.addendum
  cs.removendum = this.removendum
  return cs
}
},{"./Changeset":2,"./operations/Insert":7,"./operations/Retain":8,"./operations/Skip":9}],2:[function(require,module,exports){
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

/**
 * A sequence of consecutive operations
 *
 * @param ops.. <Operation> all passed operations will be added to the changeset
 */
function Changeset(ops/*or ops..*/) {
  this.addendum = ""
  this.removendum = ""
  this.inputLength = 0
  this.outputLength = 0
  
  if(!Array.isArray(ops)) ops = arguments
  for(var i=0; i<ops.length; i++) {
    this.push(ops[i])
    this.inputLength += ops[i].input
    this.outputLength += ops[i].output
  }
}

// True inheritance
Changeset.prototype = Object.create(Array.prototype, {
  constructor: {
    value: Changeset,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Changeset

var TextTransform = require('./TextTransform')
  , ChangesetTransform = require('./ChangesetTransform')

var Retain = require('./operations/Retain')
  , Skip = require('./operations/Skip')
  , Insert = require('./operations/Insert')

var Builder = require('./Builder')
  
/**
 * Returns an array containing the ops that are within the passed range
 * (only op.input is counted; thus not counting inserts to the range length, yet they are part of the range)
 */
Changeset.prototype.subrange = function(start, len) {
  var range = []
    , op, oplen
    , l=0
  for(var i=0, pos=0; i<this.length && l < len; i++) {
    op = this[i]
    if(op.length+pos > start) {
      if(op.input) {
        if(op.length != Infinity) oplen = op.length -Math.max(0, start-pos) -Math.max(0, (op.length+pos)-(start+len))
        else oplen = len
        range.push( op.derive(oplen) ) // (Don't copy over more than len param allows)
      }
      else {
        range.push( op.derive(op.length) )
        oplen = 0
      }
      l += oplen
    }
    pos += op.input
  }
  return range
}

/**
 * Merge two changesets (that are based on the same state!) so that the resulting changseset
 * has the same effect as both orignal ones applied one after the other
 *
 * @param otherCs <Changeset>
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely))
 * @returns <Changeset>
 */
Changeset.prototype.merge = function(otherCs, left) {
  if(!(otherCs instanceof Changeset)) {
    throw new Error('Argument must be a #<Changeset>, but received '+otherCs.__proto__.constructor.name)
  }
  
  var newops = []
    , addPtr1 = 0
    , remPtr1 = 0
    , addPtr2 = 0
    , remPtr2 = 0
    , newaddendum = ''
    , newremovendum = ''
  
  zip(this, otherCs, function(op1, op2) {
    // console.log(newops)
    // console.log(op1, op2)

    if(op1 && !op1.input && (!op2 || op2.input || left)) { // if it's a tie -- "left" breaks it.
      newops.push(op1.merge().clone())
      newaddendum += this.addendum.substr(addPtr1, op1.length) // overtake added chars
      addPtr1 += op1.length
      op1.length = 0 // don't gimme that one again.
      return
    }
    
    if(op2 && !op2.input && (!op1 || op1.input || !left)) {// if it's a tie -- "left" breaks it.
      newops.push(op2.merge().clone())
      newaddendum += otherCs.addendum.substr(addPtr2, op2.length) // overtake added chars
      addPtr2 += op2.length
      op2.length = 0 // don't gimme that one again.
      return
    }
    
    // XXX Move addendum and removendum stuff to indiv. ops
    // XXX Move everything below this to op1.merge(op2)
    
    if(op2 && !op2.output) {
      newops.push(op2.merge(op1).clone())
      newremovendum += otherCs.removendum.substr(remPtr2, op2.length) // overtake removed chars
      remPtr2 += op2.length
      if(op1) op1.length = 0 // don't gimme these again.
      op2.length = 0
      return
    }
    
    if(op1 && !op1.output) {
      newops.push(op1.merge(op2).clone())
      newremovendum += this.removendum.substr(remPtr1, op1.length) // overtake removed chars
      remPtr1 += op1.length
      op1.length = 0 // don't gimme that one again.
      if(op2) op2.length = 0
      return
    }
    
    if((op1 && op1.input == op1.output)) {
      newops.push(op1.merge(op2).clone())
      op1.length = 0 // don't gimme these again.
      if(op2) op2.length = 0
      return
    }
    
    console.log('oops', arguments)
    throw new Error('oops. This case hasn\'t been considered by the developer (error code: PBCAC)')
  }.bind(this))
  
  var newCs = new Changeset(newops)
  newCs.addendum = newaddendum
  newCs.removendum = newremovendum
  
  return newCs
}

/**
 * A private and quite handy function that slices ops into equally long pieces and applies them on a mapping function
 * that can determine the iteration steps by setting op.length to 0 on an op (equals using .next() in a usual iterator)
 */
function zip(cs1, cs2, func) {
  var opstack1 = cs1.map(function(op) {return op.clone()}) // copy ops
    , opstack2 = cs2.map(function(op) {return op.clone()})
  
  var op2, op1
  while(opstack1.length || opstack2.length) {// iterate through all outstanding ops of this cs
    op1 = opstack1[0]? opstack1[0].clone() : null
    op2 = opstack2[0]? opstack2[0].clone() : null
    
    if(op1) {
      if(op2) op1 = op1.derive(Math.min(op1.length, op2.length)) // slice 'em into equally long pieces
      if(opstack1[0].length > op1.length) opstack1[0] = opstack1[0].derive(opstack1[0].length-op1.length)
      else opstack1.shift()
    }
    
    if(op2) {
      if(op1) op2 = op2.derive(Math.min(op1.length, op2.length)) // slice 'em into equally long pieces
      if(opstack2[0].length > op2.length) opstack2[0] = opstack2[0].derive(opstack2[0].length-op2.length)
      else opstack2.shift()
    }

    func(op1, op2)
    
    if(op1 && op1.length) opstack1.unshift(op1)
    if(op2 && op2.length) opstack2.unshift(op2)
  }
}

/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the operations of the current changeset against the
 * all operations in another changeset in such a way that the
 * effects of the latter are effectively included.
 * This is basically like a applying the other cs on this one.
 * 
 * @param otherCs <Changeset>
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely)
 * 
 * @returns <Changeset>
 */
Changeset.prototype.transformAgainst = function(otherCs, left) {
  if(!(otherCs instanceof Changeset)) {
    throw new Error('Argument to Changeset#transformAgainst must be a #<Changeset>, but received '+otherCs.__proto__.constructor.name)
  }
  
  if(this.inputLength != otherCs.inputLength) {
    throw new Error('Can\'t transform changesets with differing inputLength: '+this.inputLength+' and '+otherCs.inputLength)
  }
  
  var transformation = new ChangesetTransform(this, [new Retain(Infinity)])
  otherCs.forEach(function(op) {
    var nextOp = this.subrange(transformation.pos, Infinity)[0] // next op of this cs
    if(nextOp && !nextOp.input && !op.input && left) { // two inserts tied; left breaks it
      transformation.writeOutput(transformation.readInput(nextOp.length))
    }
    op.apply(transformation)
  }.bind(this))
  
  return transformation.result()
}

/**
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms all operations in the current changeset against the operations
 * in another changeset in such a way that the impact of the latter are effectively excluded
 *
 * @param changeset <Changeset> the changeset to substract from this one
 * @param left <boolean> Which op to choose if there's an insert tie (If you use this function in a distributed, synchronous environment, be sure to invert this param on the other site, otherwise it can be omitted safely)
 * @returns <Changeset>
 */
Changeset.prototype.substract = function(changeset, left) {
  // The current operations assume that the changes in
  // `changeset` happened before, so for each of those ops
  // we create an operation that undoes its effect and
  // transform all our operations on top of the inverse changes
  return this.transformAgainst(changeset.invert(), left)
}

/**
 * Returns the inverse Changeset of the current one
 * 
 * Changeset.invert().apply(Changeset.apply(document)) == document
 */
Changeset.prototype.invert = function() {
  // invert all ops
  var newCs = new Changeset(this.map(function(op) {
    return op.invert()
  }))
  
  // removendum becomes addendum and vice versa
  newCs.addendum = this.removendum
  newCs.removendum = this.addendum

  return newCs
}

/**
 * Applies this changeset on a text
 */
Changeset.prototype.apply = function(input) {
  // pre-requisites
  if(input.length != this.inputLength) throw new Error('Input length doesn\'t match expected length. expected: '+this.inputLength+'; actual: '+input.length)
  
  var operation = new TextTransform(input, this.addendum, this.removendum)

  this.forEach(function(op) {
    // each Operation has access to all pointers as well as the input, addendum and removendum (the latter are immutable)
    op.apply(operation)
  }.bind(this))

  return operation.result()
}

/**
 * Returns an array of strings describing this changeset's operations
 */
Changeset.prototype.inspect = function() {
  var j = 0
  return this.map(function(op) {
    var string = ''

    if(!op.input) { // if Insert
      string = this.addendum.substr(j,op.length)
      j += op.length
      return string
    }
    
    for(var i=0; i<op.length; i++) string += op.symbol
    return string
  }.bind(this)).join('')
}

/**
 * Serializes the given changeset in order to return a (hopefully) more compact representation
 * than json that can be sent through a network or stored in a database
 *
 * Numbers are converted to the base 36, unsafe chars in the text are urlencoded
 *
 * @param cs <Changeset> The changeset to be serialized
 * @returns <String> The serialized changeset
 */
Changeset.prototype.pack = function() {
  var packed = this.map(function(op) {
    return op.pack()
  }).join('')
  
  var addendum = this.addendum.replace(/%/g, '%25').replace(/\|/g, '%7C')
    , removendum = this.removendum.replace(/%/g, '%25').replace(/\|/g, '%7C')
  return packed+'|'+addendum+'|'+removendum
}
Changeset.prototype.toString = function() {
  return this.pack()
}

/**
 * Unserializes the output of cs.text.Changeset#toString()
 * 
 * @param packed <String> The serialized changeset
 * @param <cs.Changeset>
 */
Changeset.unpack = function(packed) {
  if(packed == '') throw new Error('Cannot unpack from empty string')
  var components = packed.split('|')
    , opstring = components[0]
    , addendum = components[1].replace(/%7c/gi, '|').replace(/%25/g, '%')
    , removendum = components[2].replace(/%7c/gi, '|').replace(/%25/g, '%')

  var matches = opstring.match(/[=+-]([^=+-])+/g)
  if(!matches) throw new Error('Cannot unpack invalidly serialized op string')
  
  var ops = []
  matches.forEach(function(s) {
    var symbol = s.substr(0,1)
      , data = s.substr(1)
    if(Skip.prototype.symbol == symbol) return ops.push(Skip.unpack(data))
    if(Insert.prototype.symbol == symbol) return ops.push(Insert.unpack(data))
    if(Retain.prototype.symbol == symbol) return ops.push(Retain.unpack(data))
    throw new Error('Invalid changeset representation passed to Changeset.unpack')
  })
  
  var cs = new Changeset(ops)
  cs.addendum = addendum
  cs.removendum = removendum
  
  return cs
}

Changeset.create = function() {
  return new Builder
}

/**
 * Returns a Changeset containing the operations needed to transform text1 into text2
 * 
 * @param text1 <String>
 * @param text2 <String>
 */
Changeset.fromDiff = function(diff) {
  /**
   * The data structure representing a diff is an array of tuples:
   * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
   * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
   */
  var DIFF_DELETE = -1;
  var DIFF_INSERT = 1;
  var DIFF_EQUAL = 0;
  
  var ops = []
    , removendum = ''
    , addendum = ''

  diff.forEach(function(d) {
    if (DIFF_DELETE == d[0]) {
      ops.push(new Skip(d[1].length))
      removendum += d[1]
    }
    
    if (DIFF_INSERT == d[0]) {
      ops.push(new Insert(d[1].length))
      addendum += d[1]
    }
    
    if(DIFF_EQUAL == d[0]) {
      ops.push(new Retain(d[1].length))
    }
  })
  
  var cs = new Changeset(ops)
  cs.addendum = addendum
  cs.removendum = removendum
  return cs
}
},{"./Builder":1,"./ChangesetTransform":3,"./TextTransform":5,"./operations/Insert":7,"./operations/Retain":8,"./operations/Skip":9}],3:[function(require,module,exports){
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
},{"./Changeset":2,"./operations/Insert":7,"./operations/Retain":8,"./operations/Skip":9}],4:[function(require,module,exports){
function Operator() {
}

module.exports = Operator

Operator.prototype.clone = function() {
  return this.derive(this.length)
}

Operator.prototype.derive = function(len) {
  return new (this.constructor)(len)
}

Operator.prototype.pack = function() {
  return this.symbol + (this.length).toString(36)
}
},{}],5:[function(require,module,exports){
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
},{"./Changeset":2,"./operations/Insert":7,"./operations/Retain":8,"./operations/Skip":9}],6:[function(require,module,exports){
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
  , Retain = require('./operations/Retain')
  , Skip = require('./operations/Skip')
  , Insert = require('./operations/Insert')
  
exports.Operator = require('./Operator')
exports.Changeset = Changeset
exports.Insert = Insert
exports.Retain = Retain
exports.Skip = Skip

if('undefined' != typeof window) window.changesets = exports

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




/**
 * shareJS ot type API sepc support
 */

exports.name = 'changesets'
exports.url = 'https://github.com/marcelklehr/changesets'

/**
 * create([initialText])
 * 
 * creates a snapshot (optionally with supplied intial text)
 */
exports.create = function(initText) {
  return initText || ''
}

/** 
 * Apply a changeset on a snapshot creating a new one
 *
 * The old snapshot object mustn't be used after calling apply on it
 * returns the resulting
 */
exports.apply = function(snapshot, op) {
  op = exports.unpack(op)
  return op.apply(snapshot)
}

/**
 * Transform changeset1 against changeset2
 */
exports.transform = function (op1, op2, side) {
  op1 = exports.unpack(op1)
  op2 = exports.unpack(op2)
  return exports.pack(op1.transformAgainst(op2, ('left'==side)))
}

/**
 * Merge two changesets into one
 */
exports.compose = function (op1, op2) {
  op1 = exports.unpack(op1)
  op2 = exports.unpack(op2)
  return exports.pack(op1.merge(op2))
}

/**
 * Invert a changeset
 */
exports.invert = function(op) {
  return op.invert()
}
},{"./Changeset":2,"./Operator":4,"./operations/Insert":7,"./operations/Retain":8,"./operations/Skip":9}],7:[function(require,module,exports){
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
 * Insert Operator
 * Defined by:
 * - length
 * - input=0
 * - output=length
 *
 * @param length <Number> How many chars to be inserted
 */
function Insert(length) {
  this.length = length
  this.input = 0
  this.output = length
}

// True inheritance
Insert.prototype = Object.create(Operator.prototype, {
  constructor: {
    value: Insert,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Insert
Insert.prototype.symbol = '+'

var Skip = require('./Skip')
  , Retain = require('./Retain')

Insert.prototype.apply = function(t) {
  t.writeOutput(t.readAddendum(this.output))
}

Insert.prototype.merge = function() {
  return this
}

Insert.prototype.invert = function() {
  return new Skip(this.length)
}

Insert.unpack = function(data) {
  return new Insert(parseInt(data, 36))
}
},{"../Operator":4,"./Retain":8,"./Skip":9}],8:[function(require,module,exports){
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
 * Retain Operator
 * Defined by:
 * - length
 * - input=output=length
 *
 * @param length <Number> How many chars to retain
 */
function Retain(length) {
  this.length = length
  this.input = length
  this.output = length
}

// True inheritance
Retain.prototype = Object.create(Operator.prototype, {
  constructor: {
    value: Retain,
    enumerable: false,
    writable: true,
    configurable: true
  }
});
module.exports = Retain
Retain.prototype.symbol = '='

Retain.prototype.apply = function(t) {
  t.writeOutput(t.readInput(this.input))
}

Retain.prototype.invert = function() {
  return this
}

Retain.prototype.merge = function(op2) {
  return this
}

Retain.unpack = function(data) {
  return new Retain(parseInt(data, 36))
}
},{"../Operator":4}],9:[function(require,module,exports){
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
},{"../Changeset":2,"../Operator":4,"./Insert":7,"./Retain":8}]},{},[6])