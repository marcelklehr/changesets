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