---
title: "openantares — the CLI"
description: Install the openantares command-line tool from crates.io and validate or inspect .ant files, with the sysexits exit-code contract (0/64/65/66) demonstrated against the conformance goldens.
---

[`openantares`](https://crates.io/crates/openantares) is the command-line tool for validating and inspecting `.ant` files — a thin CLI over [`antares-format`](../implementation/antares-format/)'s reader, with two read-only commands.

```sh
cargo install openantares
```

```text
usage:
  openantares validate <file.ant> [file2.ant ...]
  openantares info <file.ant>
```

`validate` reads each file to the end, enforcing every container rule — framing, manifest, version policy, and the trailer's integrity hash and per-kind counts. It keeps going after a failing file and exits with the most severe code seen. `info` prints the manifest (format version, tenant/project ids, producer, selection) and the per-section record counts.

## Exit codes

Exit codes follow sysexits, matching the reference bindings' contract:

| code | meaning |
|------|---------|
| `0`  | success |
| `64` | usage error |
| `65` | a file is present but violates the spec (`EX_DATAERR`) |
| `66` | an input file cannot be opened (`EX_NOINPUT`) |

## Demonstrated against the goldens

Every transcript below is real output, run against the [conformance golden files](../format/conformance/) from [openantares/ant](https://github.com/openantares/ant/tree/main/conformance/golden) with the CLI installed from crates.io.

**Exit 0 — the positive goldens validate clean:**

```text
$ openantares validate basic.ant forward_compat.ant tombstones.ant
basic.ant: OK  version=0.3 records=7
forward_compat.ant: OK  version=0.3 records=1
tombstones.ant: OK  version=0.3 records=4
$ echo $?
0
```

**Exit 65 — the negative golden.** `major_version.ant` declares format v1.0 and is valid in every other respect; a 0.x reader must refuse it for the version, not misread it:

```text
$ openantares validate major_version.ant
major_version.ant: FAIL  file is format v1.0, this reader implements v0.3. Major versions are not compatible: a major bump means field meanings or the container framing changed, so reading it here would silently misinterpret records. Upgrade the reader to a v1.x build, or re-export the file at v0.
$ echo $?
65
```

**Exit 66 — a file that cannot be opened:**

```text
$ openantares validate no_such_file.ant
no_such_file.ant: FAIL  cannot open: No such file or directory (os error 2)
$ echo $?
66
```

**Exit 64 — a usage error** (no command, or missing file arguments) prints the usage text above.

## `info`

```text
$ openantares info basic.ant
file:            basic.ant
format:          antares
format version:  0.7 (this build reads/writes 0.7.x)
tenant id:       1
project id:      1
producer:        openantares-conformance/0.1
created at:      2026-08-10 00:00:00 UTC
selection:       {"kind":"whole_scope"}
records:         7
counts:
  schema types:      0
  vertices:          2
  edges:             1
  observations:      1
  evidence:          1
  beliefs:           1
  vectors:           1
  vertex tombstones: 0
  edge tombstones:   0
  contradiction cases: 0
  relationship proposals: 0
  ontology revisions: 0
```

The `(this build reads/writes 0.7.x)` note is [`SUPPORTED_FORMAT_VERSION`](../versioning/) speaking: when a file's minor version is ahead of the reader, both commands say so — the file verified, but this build saw a subset of what it means.
