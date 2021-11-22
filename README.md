Distributed append-only log.

Everything is WIP.

Basic Idea:

The database is a collection of single-writer/multi-reader append-only log
files.

Write to the database by submitting transactions that can only read existing
records and append new records.

Each record is a 4-tuple consisting of:
- entity ID
- transaction entity ID
- attribute ID
- value

When creating a new entity a partition key can be specified. By default the
entity ID is used. The partition key is consistently hashed to find the
partition that the record is appended to.

When creating a new entity an aggregate ID can be specified. By default it's the
same as the entity's partition key. Transactions can only read or append
entities that all share the same aggregate ID. Transactions are serialized per
aggregate.

Changes can be streamed per partition or per aggregate.
