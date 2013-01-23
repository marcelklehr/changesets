var Operation = require('../../Operation')
  , util = require('util')

/**
 * Equal Operation
 * Defined by:
 * @param accessory <Number> Something that breaks the tie (should be different for every editor/source); optional
 */
function Equal(accessory) {
  this.accessory = accessory || 0
}
module.exports = Equal
util.inherits(Equal, Operation)

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