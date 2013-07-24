
# changesets
build text-based concurrent multi-user applications using operational transformation!

[![Build Status](https://travis-ci.org/marcelklehr/changesets.png?branch=master)](https://travis-ci.org/marcelklehr/changesets)

*changesets* allows you to easily create changesets and apply them on all sites of a distributed system using Operational Transformation. It was built with the following requirements in mind:

* intention preservation (no content corruption; your edits always have the same effect)
* reversibility/invertibility (undo any edit without corrupting the content or the state)
* convergence (everybody sees the same state)

(It is clear that this library alone cannot satisfy the above requirements, but rather provide you a means to do so in your application.)

Note: While, at the current stage of development, this library only implements a plain text changeset solution, I may add support for rich text in the future. If you would like to help, feel free to contact me.

### Oppositional what?!
In case the above question just came to your mind, you better start with [Wikipedia's entry on Operational Transformation](https://en.wikipedia.org/wiki/Operational_transformation) and a comprehensive [FAQ concerning OT](http://www3.ntu.edu.sg/home/czsun/projects/otfaq); I particularly recommend reading the latter.

## Install
`npm install changesets` or `component install marcelklehr/changesets`

## Usage
In node (and using component), simply require `'changesets'`

```js
var cs = require('changesets')
```

If you're not using component in the browser, you need to load the package as a browserified javascript file...

```
<script type="text/javascript" src="node_modules/changesets/client-side.js"></script>
```

... and use the global `changesets` variable ;)

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

`Changeset#pack()` returns a smaller string representation of that changeset to address this need.
```js
var serialized = changeset.pack() // '=5-1+2=2+5=6+b|habeen -ish thing.|i'
```

`Changeset.unpack()` takes the output of `Changeset#pack()` and returns a changeset object.
```js
cs.text.Changeset.unpack(serialized) // {"0":{"length":5,"symbol":"="},"1":{"length":1,"symbol":"-"},"2":{"length":2,"symbol":"+"},"3":{"length":2,"sym ...
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
var csA = cs.text.constructChangeset(text, textA)
var csB = cs.text.constructChangeset(text, textB)
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
for (var i=2; i < edits.length; i++) {
  newEdits[i] = edits[i].transformAgainst(inverse)
  inverse = inverse.transformAgainst(newEdits[i])
}
```

This way we can effectively exclude any given changes from all following changesets.

# Under the hood
*Changesets* makes use of Neil Fraser's [*diff-match-patch* library](https://code.google.com/p/google-diff-match-patch/) for generating the diff between two texts -- an amazing library!

A Changeset, in the context of this lib, is defined as a stream of operations that all operate on some discrete range of the input text and can either . 

# Todo
* Use best effort (aka Fuzzy Patch -- see http://neil.fraser.name/writing/patch/) when applying a changeset, but allow people to check whether the changeset fits neatly, so they can still refuse changesets that don't fit neatly (?)
* add support for attributed text
* every content type should have some pre-defined initial content (e.g. text would be '')
* How to solve the false tie (FT) puzzle? it's not possible using user identifiers ([tp2](https://code.google.com/p/lightwave/source/browse/trunk/experimental/ot/README) solves it by retaining deleted chars)


# License
MIT

# Changelog

0.3.0
 * complete revamp of the algorithms and data structures
 * support for merging changesets