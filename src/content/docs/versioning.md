---
title: "Versioning: crates and format"
description: Why the Rust crates are 0.1.x while the .ant format is 0.3.x — deliberately independent version lines, SUPPORTED_FORMAT_VERSION, and the same-major compatibility rule enforced at read time.
---

**The crate version and the format version are deliberately not the same number.** The published crates are at `0.1.x`; the format they implement is `0.3`. This page exists so that difference reads as the design decision it is, not a mistake.

## Why they are independent

Under pre-1.0 semver the *minor* is the breaking slot, so aligning the crate version to the format version would force a lie the first time the Rust API breaks without the format changing — or the reverse. Instead:

- the **crate version** tracks the code's API (ordinary semver);
- the **format version** a build supports is declared by [`antares_format::SUPPORTED_FORMAT_VERSION`](https://docs.rs/antares-format/latest/antares_format/constant.SUPPORTED_FORMAT_VERSION.html), reported by [`openantares info`](../cli/#info), and enforced by the reader itself.

## The compatibility rule (normative)

A reader accepts **any MINOR at the same MAJOR** — minor bumps are additive by definition (new record kinds, new fields, new value encodings), and everything a reader already understood keeps its meaning. When a file's minor is ahead, the reader **must still read it and must say so** (`AntReader::minor_ahead`): the reader saw a subset of what the file means, and the caller decides whether that is acceptable.

A **different MAJOR is refused at read time**, with an error naming both versions — a major bump means field meanings or the container framing changed, so reading on would silently misinterpret records. The rule is [§3 of the specification](../format/spec/#3-version-compatibility), and the failure it prevents is the version gate written as `version == "0.2"`: that passes every positive test while being wrong, and v0.1 of the format shipped with exactly that bug. The [conformance suite](../format/conformance/) tests for it directly.

## The published versions

| artifact | version | links |
|----------|---------|-------|
| `.ant` format | **0.3** | [specification](../format/spec/) · [v0.3.0 release](https://github.com/openantares/ant/releases/tag/v0.3.0) |
| `ant-types` | 0.1.x | [crates.io](https://crates.io/crates/ant-types) · [docs.rs](https://docs.rs/ant-types) |
| `antares-format` | 0.1.x | [crates.io](https://crates.io/crates/antares-format) · [docs.rs](https://docs.rs/antares-format) |
| `openantares` (CLI) | 0.1.x | [crates.io](https://crates.io/crates/openantares) · [docs.rs](https://docs.rs/openantares) |

The JSON Schema keeps its own permanent identifier, [`https://openantares.org/schema/ant-0.1.schema.json`](../format/schema/), referenced by the crates and served on this site.

`openantares info` shows both version lines at once — the file's format version and what the installed build supports:

```text
format version:  0.3 (this build reads/writes 0.3.x)
```
