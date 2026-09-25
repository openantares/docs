---
title: "Python and JavaScript bindings"
description: The reference .ant parsers for Python (reader, writer, validator) and JavaScript (reader, validator) — single-file, dependency-light, sharing the CLI exit-code contract.
---

The [openantares/ant](https://github.com/openantares/ant) repository ships two reference bindings alongside the spec. They are secondary to the [canonical Rust implementation](../../implementation/antares-format/) — the Rust crate wrote the golden files the bindings are verified against — but each is a complete, single-file implementation you can read top to bottom, and each doubles as a CLI with the same [sysexits exit-code contract](../../cli/#exit-codes) as the `openantares` tool.

Get them by cloning the repository (each binding is one file — copying it into your project works too):

```sh
git clone https://github.com/openantares/ant
```

## Python — reader, writer, validator

[`bindings/python/openantares.py`](https://github.com/openantares/ant/blob/main/bindings/python/openantares.py) needs the `zstandard` package and nothing else beyond the standard library:

```sh
pip install zstandard
```

```python
from openantares import AntReader, AntWriter, validate, decode_property

with open("world.ant", "rb") as f:
    reader = AntReader(f.read())
    for record in reader:          # dicts: {"kind": ..., "data": ...}
        ...
assert reader.verified             # trailer sha256 + counts checked

summary = validate("world.ant")    # raises AntError on any violation
```

As a CLI, against a golden from the conformance suite:

```text
$ python3 bindings/python/openantares.py validate conformance/golden/basic.ant conformance/golden/originals.ant
conformance/golden/basic.ant: OK  version=0.7 records=7 skipped=0 counts={'schemaTypes': 0, 'vertices': 2, 'edges': 1, 'observations': 1, 'evidence': 1, 'beliefs': 1, 'vectors': 1, 'vertexTombstones': 0, 'edgeTombstones': 0, 'contradictionCases': 0, 'relationshipProposals': 0, 'ontologyRevisions': 0}
conformance/golden/originals.ant: OK  version=1.0 records=10 skipped=0 counts={'schemaTypes': 0, 'vertices': 0, 'edges': 0, 'observations': 0, 'evidence': 5, 'beliefs': 0, 'vectors': 0, 'vertexTombstones': 0, 'edgeTombstones': 0, 'contradictionCases': 0, 'relationshipProposals': 0, 'ontologyRevisions': 0, 'originalChunks': 3, 'originalSources': 2}
$ echo $?
0
```

## JavaScript — reader, validator

[`bindings/js/openantares.mjs`](https://github.com/openantares/ant/blob/main/bindings/js/openantares.mjs) needs Node ≥ 22.15 — the version where `node:zlib` gained native zstd — and no packages at all:

```js
import { AntReader, validate, decodeProperty } from "./openantares.mjs";

const reader = new AntReader(fs.readFileSync("world.ant"));
for (const record of reader) { ... }        // {kind, data} objects
if (!reader.verified) throw new Error("unverified");
```

As a CLI:

```text
$ node bindings/js/openantares.mjs validate conformance/golden/basic.ant conformance/golden/originals.ant
conformance/golden/basic.ant: OK  version=0.7 records=7 skipped=0 counts={"schemaTypes":0,"vertices":2,"edges":1,"observations":1,"evidence":1,"beliefs":1,"vectors":1,"vertexTombstones":0,"edgeTombstones":0,"contradictionCases":0,"relationshipProposals":0,"ontologyRevisions":0,"originalChunks":0,"originalSources":0}
conformance/golden/originals.ant: OK  version=1.0 records=10 skipped=0 counts={"schemaTypes":0,"vertices":0,"edges":0,"observations":0,"evidence":5,"beliefs":0,"vectors":0,"vertexTombstones":0,"edgeTombstones":0,"contradictionCases":0,"relationshipProposals":0,"ontologyRevisions":0,"originalChunks":3,"originalSources":2}
$ echo $?
0
```

## Decoding typed values

Both bindings expose a property decoder (`decode_property` / `decodeProperty`) for the [v0.3 typed-value envelopes](../spec/#6-property-values). Two rules they implement that a port must not lose:

- **A decimal is never converted to a native number.** `Number("12345678901234567.89")` — and `float(...)` in Python — passes through an IEEE double and silently becomes a different value. The decoders return decimals as text; use a decimal type or BigInt for arithmetic.
- **A timestamp keeps its UTC offset.** Normalizing `+02:00` to `Z` on read discards the one thing that distinguishes TIMESTAMPTZ from TIMESTAMP.

Both bindings read formats 0.7 and 1.0 — `originals.ant` above is a 1.0 file whose stored originals are reassembled from their chunks and checked against each evidence's `source_blob` — and refuse any other major. Both pass the full [conformance suite](../conformance/), including the negative fixtures, and both flag a file whose minor version is ahead of them rather than guessing.
