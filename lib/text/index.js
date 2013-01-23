var Changeset = require('../Changeset')
  , Delete = require('./operations/Delete')
  , Insert = require('./operations/Insert')
  , dmp = require('diff_match_patch')
  , engine = new dmp.diff_match_patch

// Don't optimize time if diffs become less optimal
engine.Diff_Timeout = 0

  
/**
 * Returns a Changeset containing the operations needed to transform text1 into text2
 * 
 * @param text1 <String>
 * @param text2 <String>
 * @param accessory <Number> tie breaker; optional (only necessary in a distributed environment, should be different for every editor/source)
 */
exports.constructChangeset = function(text1, text2, accessory) {
  accessory = accessory || 0
  var diff = engine.diff_main(text1, text2, /* checkLines: */ false)
  engine.diff_cleanupEfficiency(diff)
  
  var i = 0
    , cs = new Changeset
  diff.forEach(function(d) {
    if (dmp.DIFF_DELETE == d[0]) {
      cs.push(new Delete(i, d[1], accessory))
      i += d[1].length
    }
    
    if (dmp.DIFF_INSERT == d[0]) {
      cs.push(new Insert(i, d[1], accessory))
    }
    
    if(dmp.DIFF_EQUAL == d[0])
      i += d[1].length
  })
  
  return cs
}
