A cluster contains nodes and databases.

A database contains topics and attributes.

Topics contain partitions which are individual append-only log files containing
entity-attribute-value tuples (EAVT).

When a new entity is created an optional partition key can be provided. The
partition key determines which topic-partition the entity is stored in. By
default the entity ID is used.

When a new entity is created an optional aggregate key can be provided. Only
entities with the same aggregate key can be read/modified in the same
transaction. By default, the partition key is used as an aggregate key. Ie,
transactions are serialized by aggregate key.

Every appended entity record has a transaction ID. If an entity has a custom
aggregate key, then the aggregate key + a monotonically increasing version
number is used. Otherwise, the entity doesn't need an explicit transaction ID
and can just use the record offset as a version number.

Attribute references in entity records are the attribute ID and the database
version when that attribute entity was last modified.

The database is a special entity with a `db/db-name` attribute which can be
modified. The database aggregate key is it's own ID.

Topics are special entities with a `db/topic-name` attribute which can be
modified. The topic aggregate key is the database ID.

Attributes are special entities with the follow (meta)-attributes:
- `db/attr-name`
- `db/attr-handler`
- `db/attr-unique`

The attribute aggregate key is the database ID.

TODO: Think about how we could support database-serialized transactions for use
cases where we want to transactionally read/modify entities in different
aggregates. Useful for things like bulk inserts. Would need to coordinate all
aggregate partitions to serialize any new tranactions and then coordinate
consumers to read from the same output queue. At what point could output go back
to per-aggregate queues?

MVP: Topic-partitions are not explicitly modelled as entities and the number of
partitions a topic has cannot be changed after the topic is created.

MVP: Need to implement per-partition consumers for reads.