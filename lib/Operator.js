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