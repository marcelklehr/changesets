function Operation() {
}

module.exports = Operation

Operation.prototype.clone = function() {
  return new (this.constructor)(this.length)
}