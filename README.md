# changesets [![Build Status](https://travis-ci.org/marcelklehr/changesets.png?branch=master)](https://travis-ci.org/marcelklehr/changesets)
build text-based concurrent multi-user applications using operational transformation!

Easily create and apply changesets at all sites of a distributed system, leveraging Operational Transformation with:

* convergence (everybody sees the same state, eventually)
* intention preservation (put the 's' into 'sock' and it'll stay a sock)
* reversibility (undo any edit without problems)

News: *changesets* now supports the ottypes API spec of shareJS.

## Install
`npm install changesets` or `component install marcelklehr/changesets`

In node and with component:

```js
var Changeset = require('changesets').Changeset
```

In the bare browser:

```html
<script type="text/javascript" src="node_modules/changesets/client-side.js"></script>
<script type="text/javascript">
// ...
var Changeset = changesets.Changeset
// ...
</script>
```

Support for adding more module systems is greatly appreaciated.


The return value of `require('changesets')` or the global `changesets` has a shareJS ottype interface.


# Usage
A changeset is an ordered list of operations. There are 3 types of operations: Retain (retains a number of chars), Insert (inserts a number of chars), Skip (deletes them).

Now, Suppose we have two texts
```js
var text1 = 'Rockets fly higher than rocks'
  , text2 = 'Rockets can fly higher than rocks, usually'
```

To construct a changeset by hand, just do
```js
var cs = Changeset.create()
  .retain(8)
  .insert('can ')
  .retain(21)
  .insert(', usually')
  .end()
```

You can also directly pass a diff created with  [diff_match_patch](https://github.com/marcelklehr/diff_match_patch), so to construct a changeset between two texts:
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

In many cases you will find the need to serialize your changesets in order to efficiently transfer them through the network or store them on disk.
```js
var serialized = changeset.pack() // '=5-1+2=2+5=6+b|habeen -ish thing.|i'
```

`Changeset.unpack()` takes the output of `Changeset#pack()` and returns a changeset object.
```js
Changeset.unpack(serialized) // {"0":{"length":5,"symbol":"="},"1":{"length":1,"symbol":"-"},"2":{"length":2,"symbol":"+"},"3":{"length":2,"sym ...
```

If you'd like to display a changeset in a more humanly readable form, use `Changeset#inspect` (which is aliased to Changeset#toString):

```js
changeset.inspect() // "=====-ha==been ======-ish thing."
```

Retained chars are displayed as `=` and removed chars as `-`. Insertions are displayed as the characters being inserted.

### Transforming them

#### Inclusion Transformation
Say, for instance, you give a text to two different people. Each of them makes some changes and hands them back to you.

```js
var rev0 = "Hello adventurer!"
  , revA = "Hello treasured adventurer!"
  , revB = "Good day adventurers, y'all!"
```

As a human you're certainly able to make out the changes and tell what's been changed to combine both revisions, for your computer it's harder.
Firstly, you'll need to extract the changes in each version.

```js
var csA = computeChanges(rev0, revA)
var csB = computeChanges(rev0, revB)
```

Now we can send the changes of `revA` from side A over the network to B and if we apply them on the original revision we get the full contents of revision A again.

```js
csA.apply(rev0) == revA // true
```

But we don't want to apply them on the original revision, because we've already changed the text and created `revB`. We could of course try and apply it anyway:

```js
csA.apply(revB) // apply csA on revision B -> "Good dtreasured ay adventurer!"
```

Ah, bad idea.

Since changeset A still assumes the original context, we need to adapt it, based on the changes of changeset B that have happened in the meantime, In order to be able to apply it on `revB`.

```js
var transformedCsA = csA.transformAgainst(csB)

transformedCsA.apply(revB) // "Good day treasured adventurers, y'all!"
```

This transformation is called *Inclusion Transformation*, which adjusts a changeset in a way so that it assumes the changes of another changeset already happened.

#### Exclusion Transformation
Imagine a text editor, that allows users to undo any edit they've ever done to a document without undoing all edits that were done afterwards.

We decide to store all edits in a list of changesets, where each applied on top of the other results in the currently visible document.

Let's assume the following document with 4 revisions and 3 edits.

```js
var versions =
[ ""
, "a"
, "ab"
, "abc"
]

// For posterity we create the edits like this

var edits = []
for (var i=1; i < versions.length; i++) {
  edits.push( computeChanges(text[i-1], text[i]) )
}
```

We can undo the last edit, by removing it from the stack of edits, inverting it and applying it on the current text.

```js
var lastEdit = edits.pop()
newEditorContent = lastEdit.invert().apply(currentEditorContent)
```

Now, if we want to undo *any* edit, let's say the second instead of the last, we need to construct the inverse changeset of that second edit.

```js

```

Then, we transform all following edits against this inverse changeset. But in order for this "undo changeset" to fit for the next changeset also, we in turn transform it against all previously iterated edits.

```js
var undoIndex = 1

var undoCs = edits[undoIndex].invert()

var newEdits = [], edit
for (var i=undoIndex+1; i < edits.length; i++) {
  edit = edits[i]
  newEdits[i] = edit.transformAgainst(undoCs)
  undoCs = undoCs.transformAgainst(edit)
}
```

This way we can effectively exclude any given changes from all changes that follow it. This is called *Exclusion Transformation*.

### Attributes
As you know, there are 3 types of operations (`Retain`, `Skip` and `Insert`) in a changeset, but actually, there are four. The forth is an operation type called `Mark`.

Mark can be used to apply attributes to a text. Currently attributes are like binary flags: Either a char has an attribute or it doesn't. Attributes are integer numbers (you'll need to implement some mapping between attribute names and these ids). You can pass attributes to the `Mark` operation as follows:

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

Did you notice the negative number? While positive numbers result in the application of some attribute, negative numbers enforce the removal of an attribute that has already been applied on some range of the text.

Now, how can you deal with those attributes? Currently, you'll have to keep changes to attributes in separate changesets. Storing attributes for a document can be done in a changeset with the length of the document into which you merge attribute changes. Applying them is as easy as iterating over the operations of that changeset (`changeset.forEach(fn..)`) and i.e. inserting HTML tags at respective positions in the corresponding document.

*Warning:* Attributes are still experimental. There are no tests, yet, and the API may change in the future.

## Todo

* Maybe support TP2? ([lightwave](https://code.google.com/p/lightwave/source/browse/trunk/experimental/ot/README) solves the FT puzzle by retaining deleted chars)
* vows is super ugly. Switch to mocha!

## License
MIT

## Changelog

0.4.0
 * Modularize operations
 * Attributes (Mark operation)
 * shareJS support as an ot type

0.3.1
 * fix Changeset#unpack() regex to allow for ops longer than 35 chars (thanks to @jonasp)

0.3.0
 * complete revamp of the algorithms and data structures
 * support for merging changesets
