function Operation() {
}

module.exports = Operation

Operation.prototype.clone = function() {
  return new (this.constructor)(this.length)
}

Operation.prototype.pack = function() {
  return this.symbol + (this.length).toString(36)
}