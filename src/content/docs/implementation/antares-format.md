---
title: "antares-format — reader and writer"
description: The canonical Rust implementation of the .ant container — a streaming, integrity-verifying reader and writer, with a complete write→read→validate example compiled from the published crates.
---

[`antares-format`](https://crates.io/crates/antares-format) is the canonical implementation of the `.ant` container: a streaming writer (records in, `.ant` bytes out) and a streaming reader that verifies integrity as it goes. It is the writer that produced the [conformance golden files](../../format/conformance/), and it is the implementation the format's reference bindings are checked against.

```sh
cargo add ant-types antares-format
```

API reference: [docs.rs/antares-format](https://docs.rs/antares-format). Record payloads are the serde JSON of the [`ant-types`](../ant-types/) record types.

The Antares engine that fills and reasons over these files is a separate, private system — this crate depends on none of it, and neither do you: reading, writing, and verifying `.ant` files needs only what is on this page.

## The container in one paragraph

One zstd-compressed stream of NDJSON records: a `manifest` first, data records in the middle, and a `trailer` last carrying per-kind counts and a SHA-256 over every preceding uncompressed line — so truncation and tampering are detectable in a single pass, without a side channel. Compatibility is same-major: any minor at the same major is readable (minor bumps are additive-only; unknown record kinds are skipped, and `AntReader::minor_ahead` reports when a file is newer than the reader). A different major is refused explicitly. The full rules live in the [specification](../../format/spec/).

## Write a file, read it back, validate it

A complete program: write a small `.ant` with a vertex (including an exact decimal property) and an evidence record, read it back, and confirm the reader verified the trailer hash and counts.

:::note[Compiled from the registry]
This example was built as the **first outside consumer** of the published crates: a fresh Cargo project, `cargo add ant-types@0.1 antares-format@0.1` from crates.io — no source checkout, no path dependencies. It compiled and ran first try; the output below is the program's real output.
:::

```rust
// [dependencies]  ant-types = "0.5", antares-format = "0.5"
use std::collections::BTreeMap;

use ant_types::{
    Decimal, Evidence, ProjectId, PropertyValue, TenantId, TypeName, Vertex, VertexId,
};
use antares_format::{AntError, AntReader, AntRecord, AntWriter, Manifest, FORMAT_VERSION};

fn main() -> Result<(), AntError> {
    // --- write a small .ant file ---
    let manifest = Manifest {
        format: "antares".into(),
        version: FORMAT_VERSION.into(),
        tenant_id: 1,
        project_id: 1,
        selection: None,
        created_at: None,
        producer: Some("quickstart/0.1".into()),
    };

    // Any `std::io::Write` works as the sink; level 0 = zstd default.
    let mut writer = AntWriter::new(Vec::new(), manifest, 0)?;

    let mut properties = BTreeMap::new();
    properties.insert("stage".to_string(), PropertyValue::Text("signed".into()));
    // Decimal is exact (i128 unscaled digits + scale) — this value does
    // not fit an IEEE double, and it round-trips digit for digit.
    properties.insert(
        "exact_amount".to_string(),
        PropertyValue::Decimal(Decimal::parse("12345678901234567.89").unwrap()),
    );

    writer.write(AntRecord::Vertex {
        data: Vertex {
            id: VertexId("deal_1".into()),
            name: "Example Deal".into(),
            label: TypeName("Demo.Deal".into()),
            properties,
        },
    })?;
    writer.write(AntRecord::Evidence {
        data: Evidence::quick(
            "ev1",
            TenantId(1),
            ProjectId(1),
            "note",
            "n1",
            "The deal was signed on the call.",
        ),
    })?;

    let bytes = writer.finish()?; // appends the trailer: counts + sha256
    std::fs::write("hello.ant", &bytes).expect("write hello.ant");

    // --- read it back, verifying as we go ---
    let file = std::fs::File::open("hello.ant").expect("open hello.ant");
    let mut reader = AntReader::new(file)?;
    while let Some(record) = reader.next_record()? {
        match record {
            AntRecord::Vertex { data } => {
                println!("vertex  {} ({})", data.id.0, data.label.0);
                if let Some(PropertyValue::Decimal(d)) = data.properties.get("exact_amount") {
                    println!("        exact_amount = {d} (exact decimal)");
                }
            }
            AntRecord::Evidence { data } => println!("evidence {}: {}", data.id.0, data.content),
            _ => {}
        }
    }

    // `verified` flips true only after the trailer's sha256 and per-kind
    // counts matched what the reader saw.
    assert!(reader.verified);
    assert!(!reader.minor_ahead);
    println!(
        "verified .ant, format version {} (this build supports {}.x)",
        reader.manifest.version,
        antares_format::SUPPORTED_FORMAT_VERSION
    );
    Ok(())
}
```

Output:

```text
vertex  deal_1 (Demo.Deal)
        exact_amount = 12345678901234567.89 (exact decimal)
evidence ev1: The deal was signed on the call.
verified .ant, format version 0.7 (this build supports 0.7.x)
```

The file it wrote is a real, spec-complete `.ant` — the [CLI](../../cli/) validates it:

```text
$ openantares validate hello.ant
hello.ant: OK  version=0.7 records=2
```

## The API surface

**Writer** — [`AntWriter`](https://docs.rs/antares-format/latest/antares_format/struct.AntWriter.html):

- `AntWriter::new(out, manifest, level)` writes the manifest line into any `std::io::Write` sink (`level` is the zstd compression level, `0` = default).
- `write(AntRecord)` appends one record; the writer keeps the running per-kind `Counts` and the running hash.

**Records** — [`AntRecord`](https://docs.rs/antares-format/latest/antares_format/enum.AntRecord.html) has one variant per data kind: `SchemaType`, `Vertex`, `Edge`, `Observation`, `Evidence`, `Belief`, `Vector`, `VertexTombstone`, `EdgeTombstone` (0.2), `ContradictionCase` (0.4), `RelationshipProposal` (0.5) and `OntologyRevision` (0.7), plus the `Trailer`. The enum is matched exhaustively by consumers, which is why a format minor that adds a kind is a crate minor — see [Versioning](../../versioning/).
- `finish()` appends the trailer (counts + SHA-256) and flushes the zstd frame, returning the sink.

**Reader** — [`AntReader`](https://docs.rs/antares-format/latest/antares_format/struct.AntReader.html):

- `AntReader::new(input)` reads and checks the manifest from any `std::io::Read` source: zstd framing, `format == "antares"`, and the version policy — a different **major is refused at read time**, with an error naming both versions.
- `next_record()` streams records one at a time; unknown kinds are skipped (but still hashed). `Ok(None)` is returned only after the trailer verified.
- `manifest` (public field) is available immediately after construction; `version` is the parsed file version.
- `verified` — true once the trailer's SHA-256 and per-kind counts matched what the reader saw. Truncation, tampering, data after the trailer, and count mismatches all surface as errors instead.
- `minor_ahead` — true when the file's minor version is ahead of this build: the file is readable, but it may contain record kinds or value encodings this reader does not know. A caller that needs completeness can refuse; one that does not can proceed.

**Version constants** — `FORMAT_VERSION` (the `MAJOR.MINOR` written into new manifests) and [`SUPPORTED_FORMAT_VERSION`](https://docs.rs/antares-format/latest/antares_format/constant.SUPPORTED_FORMAT_VERSION.html) (the format this build reads and writes — see [Versioning](../../versioning/) for why this is not the crate version), plus `FormatVersion` with the parse and compatibility rules.

**Errors** — everything is `AntError`, one enum for framing, version, JSON, and integrity failures.
