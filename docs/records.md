# Tuples

MVP: Records are UTF-8 encoded JSON.

## Entities-Attribute-Value

Params:
- topic         topic id

Attributes:
- partition     partition key
- aggregate     aggregate key/id

Record:
- checksum!     ...
- offset!       ...
- size!         ...
- id            unique id
- transaction   transaction id
- attribute     attribute id
- value         data

## Immutable Values

Params:
- topic         ...

Record:
- checksum!     ...
- offset!       ...
- size!         ...
- source        ...
- partition?    ...
- time          lamport timestamp
- index         index
- cause         causal parent `source + time + index`
- attribute     attribute id
- value         data
