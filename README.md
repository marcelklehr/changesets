
# changesets
build text-based concurrent multi-user applications using operational transformation!

[![Build Status](https://travis-ci.org/marcelklehr/node-changesets.png?branch=master)](https://travis-ci.org/marcelklehr/node-changesets)

*changesets* allows you to easily create changesets and apply them on all sites of a distributed system using Operational Transformation. It was built with the following requirements in mind:

* intention preservation (no content corruption; your edits always have the same effect)
* reversibility/invertibility (undo any edit without corrupting the content or the state)
* convergence (everybody sees the same state)

Note: While, at the current stage of development, this library only implements a text-based changeset solution, I intend to add functionality for tree-based data and at some point in the future maybe even images. If you would like to help, feel free to contact me.

### Oppositional what?!
In case the above question just came to your mind, you better start with [Wikipedia's entry on Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation) and a comprehensive [FAQ concerning OT](http://www3.ntu.edu.sg/home/czsun/projects/otfaq); I particularly recommend reading the latter.

## Install
`npm install changesets`

In your code, `require('changesets')`

## Usage
```
var cs = require('changesets')
```

### Constructing and applying changesets
Construct a changeset between two texts:
```js
var changes = cs.text.constructChangeset(text1, text2)
```
You get a `cs.text.Changeset` object containing multiple `cs.Operation`s. The changeset can be applied to a text as follows:
```js
var finalText = changes.apply(text1)

finalText == text2 // true
```

### Serializing changesets
In many cases you will find the need to serialize your changesets in order to efficiently transfer them through the network or store them on disk.

`Changeset#pack()` takes a changeset object and returns the string representation of that changeset.
```js
var serialized = changeset.pack() // '+1:YWI:0+2:Yw:0-3:NA:0+9:YWthYmw:0+b:cmFkYQ:0'
```

`Changeset.unpack()` takes the output of `Changeset#pack()` and returns a changeset object.
```js
cs.text.Changeset.unpack(serialized) // {"0":{"accessory":0,"pos":1,"len":2,"text":"ab"},"1":{"accessory":0,"pos":2,"len":1,"text":"c"},"2":{"accessory":0,"pos":3,"len":1,"text" ...
```

If you'd like to display a changeset in a humanly readable form, use `Changeset#inspect`:

```js
changeset.inspect() // [ 'Insert 1:ab', 'Insert 2:c', 'Delete 3:4', 'Insert 9:akabl', 'Insert 11:rada' ]
```

### Operational transformation
*Inclusion Transformation* as well as *Exclusion Transformation* is supported.

#### Inclusion Transformation
Say, for instance, you give a text to two different people. Each of them makes some changes and hands them back to you.
```js
var text = "Hello adventurer!"
  , textA = "Hello treasured adventurer!"
  , textB = "Good day adventurers, y'all!"
```
Now, what do you do? As a human you're certainly able to determine the changes and apply them both on the original text, but a machine is hard put to do so without proper guidance. And this is where this library comes in. Firstly, you'll need to extract the changes in each version.
```js
var csA = cs.text.constructChangeset(text, textA)
var csB = cs.text.constructChangeset(text, textB)
```
The problem is that at least one changeset becomes invalid when we try to apply it on a text that was created by applying the other changeset, because they both still assume the original context:
```js
csA.apply(textB) // -> "Good dtreasured ay adventurer!"
csB.apply(textA) // -> "Good day treasured advs, y'allenturer!"
```
Doesn't look that good.

But since we can at least safely apply one of them, let's apply changeset A first on the original text. Now, in order to be able to apply changeset B, which still assumes the original context, we need to adjust it, based on the changes of changeset A, so that it still has the same effect on the text.
```js
var csB_new = csB.transformAgainst(csA)

textA = csA.apply(text)
csB_new.apply(textA)
// "Good day treasured adventurers, y'all!"
```
In this scenario we employed *Inclusion Transformation*, which adjusts a changeset in a way so that it assumes the changes of another changeset already happened.

#### Exclusion Transformation
Imagine a text editor, that allows users to undo any edit they've ever done to a document. Naturally, one will choose to store all edits as a list of changesets, where each applied on top of the other results in the currently visible document.
```js
var versions =
[ ""
, "a"
, "ab"
, "abc"
]

var edits = []
for (var i=1; i < versions.length; i++) {
  edits.push( cs.text.constructChangeset(text[i-1], text[i]) )
}
```
Now, if we want to undo a certain edit in the document's history without undoing the following edits, we need to construct the inverse changeset of the given one.
```js
var inverse = edits[1].invert()
```
Now we transform all following edits against this inverse changeset and in turn transform it against the previously iterated edits.
```
var newEdits = []
for (var i=1; i < edits.length; i++) {
  newEdits[i] = edits[i].transformAgainst(inverse)
  inverse = inverse.transformAgainst(newEdits[i])
}
```
This way we effectively exclude the given changes from all following changesets.

# Under the hood
*Changesets* makes use of Neil Fraser's [*diff-match-patch* library](https://code.google.com/p/google-diff-match-patch/) for generating the diff between two texts -- an amazing library!

A Changeset, in the context of this lib, is defined as a group of context-equivalent operations. This means, they can be applied in any possible order as long as they're transformed against the previous ones to match the current document state.
When you call Changeset#apply(), the method first transforms all contained operations on top of each other in a certain order, and then applies them all in sequence on the passed document.

# Todo
* What happens, if you apply the same CS multiple times, with or without transforming it?
* Perhaps add text length diff to `Operation`s in order to be able validate them
* Simplify anyundo (large numbers of changesets have to be transformed against each other and an undo changseset)

# License
MIT