module.exports = function Operation() {
}

Operation.prototype.clone = function() {
  return new (this.constructor)(this.length)
}