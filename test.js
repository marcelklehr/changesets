cs = require('./lib/Changeset')

var a = 'a'
  , a2 = a+'0'
  , b = 'b'
c = cs.fromDiff(a, b)
console.log(a, '=>', b, ' = cs('+ c+')')

console.log('cs.apply(a) =', c.apply(a))

c2 = cs.fromDiff(a, a2)

console.log(a, '=>', a+'0', ' = cs2('+ c2+')')

var n = c.transformAgainst(c2)

console.log('transform(cs, cs2).apply(a2) =', n.apply(a2))