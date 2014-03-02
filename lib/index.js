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