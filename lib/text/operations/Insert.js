var Operation = require('../../Operation')
  , util = require('util')

/**
 * Insert Operation
 * Defined by:
 * @param pos <Number> The character index in the text at which the string should be inserted
 * @param text <String> The string to be inserted
 * @param accessory <Number> Something that breaks the tie (should be different for every editor/source); optional
 */
function Insert(pos, text, accessory) {
  this.accessory = accessory || 0
  this.pos = pos
  this.len = text.length
  this.text = text
}

util.inherits(Insert, Operation)
module.exports = Insert

var Delete = require('./Delete')
  , Equal = require('./Equal')

/**
 * Inclusion Transformation (IT) or Forward Transformation
 *
 * transforms the current operation against another operation in such
 * a way that the impact of the latter is effectively included
 */
Insert.prototype.transformAgainst = function(change) {
  // Insert
  if (change instanceof Insert) {
  
    // 'abc' =>  0:+x('xabc') | 3:+x('abcx')
    // 'xabcx'
    if (this.pos < change.pos) {
      return new Insert(this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>   1:+x('axbc') | 1:+y('aybc')
    // 'ayxbc'  -- depends on the accessory (the tie breaker)
    if (this.pos == change.pos && this.accessory < change.accessory) {
      return new Insert(this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>   1:+x('axbc') | 0:+x('xabc')
    // 'xaxbc'
    if (change.pos < this.pos) {
      return new Insert(this.pos+change.len, this.text, this.accessory)
    }
  }

  // Delete
  if (change instanceof Delete) {
  
    // 'abc'=>  1:+x('axbc') | 2:-1('ab')
    // 'axb'
    if (this.pos < change.pos) {
      return new Insert(this.pos, this.text, this.accessory)
    }
    
    // 'abc'=>  1:+x('axbc') | 1:-1('ac')
    // 'axb'
    if (this.pos == change.pos) {
      return new Insert(this.pos, this.text, this.accessory)
    }
    
    //'abc'=> 2:+x('abxc') | 0:-2('c')
    //'xc'
    if (change.pos < this.pos) {
      // Shift this back by `change.len`, but not more than `change.pos`
      return new Insert(Math.max(this.pos - change.len, change.pos), this.text, this.accessory)
    }
  }
  
  // Equal
  if(change instanceof Equal) return this
  
  throw new Error('Invalid value supplied to Insert#transformAgainst(); expected #<changesets.Operation>, but got #<'+change.__proto__.constructor.name+'>')
}

/**
 * Exclusion Transformation (ET) or Backwards Transformation
 * 
 * transforms the current operation against another operation in such a way
 * that the impact of the latter is effectively excluded
 */
Insert.prototype.substract = function(change) {
  // The current operation already assumes that
  // the other `change` happened, so we create an operation
  // that undoes the effect of `change` and transform the
  // current operation on top of the inverse `change`
  return this.transformAgainst(change.invert())
}

/**
 * Returns the inverse Operation of the current one
 * 
 * Operation.invert().apply(Operation.apply(text)) == text
 */
Insert.prototype.invert = function() {
  return new Delete(this.pos, this.text, this.accessory)
}

/**
 * Applies this operation on the passed text
 *
 * @param text <String>
 */
Insert.prototype.apply = function(text) {
  return text.slice(0, this.pos) + this.text + text.slice(this.pos)
}
