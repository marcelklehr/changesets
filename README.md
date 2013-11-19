# changesets
build text-based concurrent multi-user applications using operational transformation!

[![Build Status](https://travis-ci.org/marcelklehr/changesets.png?branch=master)](https://travis-ci.org/marcelklehr/changesets)

*changesets* allows you to easily create changesets and apply them on all sites of a distributed system using Operational Transformation. It was built with the following requirements in mind:

* intention preservation (no content corruption; your edits always have the same effect, as long as they are applied in a consistent order)
* reversibility/invertibility (undo any edit without corrupting the content or the state)
* convergence (everybody sees the same state)

### Oppositional what?!
In case the above question just came to your mind, you better start with [Wikipedia's entry on Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation) and a comprehensive [FAQ concerning OT](http://www3.ntu.edu.sg/home/czsun/projects/otfaq); I particularly recommend reading the latter.

## Install
`npm install changesets` or `component install marcelklehr/changesets`

## Usage
In node (and using component), simply require `'changesets'`

```js
var Changeset = require('changesets').Changeset
```

If you're not using component in the browser, you need to load the package as a browserified javascript file...

```
<script type="text/javascript" src="node_modules/changesets/client-side.js"></script>
```

... and use the global `changesets` variable ;)

### Constructing and applying changesets
A changeset is an ordered list of operations. There are 3 types of operations:
 * Retain (retains a number of chars),
 * Skip (skips a number of chars, effectively deletes them),
 * Insert (inserts a number of chars)

Suppose we have two texts
```js
var text1 = 'bla bla gibberish'
  , text2 = 'blaa blah blah'
```
 
To construct a changeset by hand, just do
```js
var changeset = new Changeset([op1, op2, ...])
changeset.addendum = // ...
changeset.removendum = // ...    // I'll add a nice API for this soon ;)
```

Changesets easily integrates with Neil Fraser's [diff_match_patch](https://github.com/marcelklehr/diff_match_patch), so to construct a changeset between two texts:
```js
var dmp = require('diff_match_patch')
  , engine = new dmp.diff_match_patch

var diff = engine.diff_main(text1, text2)
var changeset = Changeset.fromDiff(diff)
```

Changesets can be applied to a text as follows:
```js
var applied = changeset.apply(text1)

applied == text2 // true
```

### Serializing changesets
In many cases you will find the need to serialize your changesets in order to efficiently transfer them through the network or store them on disk.

`Changeset#pack()` returns a smaller string representation of that changeset to address this need.
```js
var serialized = changeset.pack() // '=5-1+2=2+5=6+b|habeen -ish thing.|i'
```

`Changeset.unpack()` takes the output of `Changeset#pack()` and returns a changeset object.
```js
Changeset.unpack(serialized) // {"0":{"length":5,"symbol":"="},"1":{"length":1,"symbol":"-"},"2":{"length":2,"symbol":"+"},"3":{"length":2,"sym ...
```

If you'd like to display a changeset in a humanly readable form, use `Changeset#inspect` (which is aliased to Changeset#toString):

```js
changeset.inspect() // "=====-ha==been ======-ish thing."
```

Retained chars are displayed as `=` and removed chars as `-`. Insertions are displayed as the characters being inserted.

### Operational transformation
*Inclusion Transformation* as well as *Exclusion Transformation* is supported.

#### Inclusion Transformation
Say, for instance, you give a text to two different people. Each of them makes some changes and hands them back to you.

```js
var text = "Hello adventurer!"
  , textA = "Hello treasured adventurer!"
  , textB = "Good day adventurers, y'all!"
```

Now, what do you do? As a human you're certainly able to make out the changes and tell what's been changed to combine both revisions, but a machine is hard put to do so without proper guidance. And this is where this library comes in. Firstly, you'll need to extract the changes in each version.

```js
var csA = ChangesetFromDiff(text, textA)
var csB = ChangesetFromDiff(text, textB)
```

Now we can send the changes through the network in an eficient way and if we apply them on the original text on the other end we get the full contents of revision A again.

```js
csA.apply(text) == textA // true

csB.apply(text) == textB // true
```

The problem is that at least one changeset becomes invalid when we try to apply it on a text that was created by applying the other changeset, because they both still assume the original text:

```js
csA.apply(textB) // apply csA on revision B -> "Good dtreasured ay adventurer!"
csB.apply(textA) // apply csB on revision A -> "Good day treasured advs, y'allenturer!"
```

Doesn't look that good.

But since we can at least safely apply one of them, let's apply changeset A first on the original text. Now, in order to be able to apply changeset B, which still assumes the original context, we need to adapt it, based on the changes of changeset A, so that it still has the same (originally intended) effect on the text.

```js
var csB_new = csB.transformAgainst(csA)

textA = csA.apply(text)
csB_new.apply(textA) // "Good day treasured adventurers, y'all!"
```
In this scenario we employed *Inclusion Transformation*, which adjusts a changeset in a way so that it assumes the changes of another changeset already happened.

#### Exclusion Transformation
Imagine a text editor, that allows users to undo any edit they've ever done to a document. In this scenario, it makes sense to store all edits in a list of changesets, where each applied on top of the other results in the currently visible document.

Let's assume the following document with 4 revisions and 3 edits.

```js
var versions =
[ ""
, "a"
, "ab"
, "abc"
]

// create edits

var edits = []
for (var i=1; i < versions.length; i++) {
  edits.push( ChangesetfromDiff(text[i-1], text[i]) )
}
```

Now, if we want to undo a certain edit in the document's history without undoing the following edits, we need to construct the inverse changeset of the given one.

```js
var inverse = edits[1].invert()
```

Now we transform all following edits against this inverse changeset and in turn transform it against the previously iterated edits.

```
var newEdits = []
for (var i=2; i < edits.length; i++) {
  newEdits[i] = edits[i].transformAgainst(inverse)
  inverse = inverse.transformAgainst(newEdits[i])
}
```

This way we can effectively exclude any given changes from all following changesets.

### Attributes
As you know, there are 3 types of operations (`Retain`, `Skip` and `Insert`), but actually, there are four. The forth is an operation type called `Mark`.

Mark can be used to apply attributes to a text. Currently attributes are like binary flags: Either a char has an attribute or it doesn't. Attributes are integer numbers (you'll need to implement some mapping between attributes and their ids). You can pass attributes to the `Mark` operation as follows:

```js
var mark = new Mark(/*length:*/5, {
  0: 1
, 7: 1
, 3: 1
, 15: 1
, -2: 1
, 11: 1
})
```

Did you notice the negative number? Negative numbers enforce the removal of an attribute that has been applied on some range of the text, while positive numbers result in the application of some attribute.

Now, how can you deal with those attributes? Currently, you'll have to store changes to attributes in separate changesets. Storing attributes for a document can be done in a changeset into which you merge attribute changes. Applying them is as easy as iterating over the operations of that chagneset (`changeset.forEach(fn..)`) and i.e. inserting HTML tags at respective positions in the corresponding document.

*Warning:* Attributes are still experimental. There are no tests, yet, and the API may change in the future.

## Todo

* Maybe support TP2? ([lightwave](https://code.google.com/p/lightwave/source/browse/trunk/experimental/ot/README) solves the FT puzzle by retaining deleted chars)
* vows is super ugly. Switch to mocha!

## License
MIT

## Changelog

0.3.1
 * fix Changeset#unpack() regex to allow for ops longer than 35 chars (thanks to @jonasp)

0.3.0
 * complete revamp of the algorithms and data structures
 * support for merging changesets
