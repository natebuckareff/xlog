# Configuration Database Schema

MVP: The system is bootstrapped using postgres to manage cluster state.

## Nodes

A node is a server with a hostname, port, and  number of CPUs. Nodes manage
partition storage and execute transactions.

```sql
CREATE TABLE nodes (
	id 		    INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	uuid		UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    hostname    TEXT NOT NULL,
    port        INT NOT NULL,
    cpus        INT NOT NULL,

	UNIQUE (hostname, port)
)
```

## Databases

A database is a collection of partitions, which are stored on nodes.

```sql
CREATE TABLE databases (
	id 		    INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	uuid		UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
	version		INT NOT NULL,
	name		TEXT NOT NULL UNIQUE
)
```

## Attributes

```sql
CREATE TABLE attributes (
	pk			    INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	id			    INT NOT NULL GENERATED ALWAYS AS IDENTITY,
	db_id		    INT NOT NULL REFERENCES databases (id),	
	db_version	    INT NOT NULL,
	time		    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
	name		    TEXT NOT NULL,
	handler_id	    UUID NOT NULL,
	is_unique	    BOOLEAN NOT NULL,

	UNIQUE          (id, db_id, db_version),
	UNIQUE 		    (db_id, name)
);
```

The attributes table is append-only.

Attributes are referenced (in records) using `id + db_version`.

`handler_id` should be a reference to an immutable function that validates any
values associated with an entity and attribute.

When `is_unique` is true, all transactions must check that the value being
associated with a given entity and attribute is unique in the database.

## Topics

A topic is a logical collection of paritions. The number of partitions in a
topic can be changed which will trigger rebalancing of all affected partitions
in that topic.

Topics are referenced by their `id` and `db_version`

```sql
CREATE TABLE topics (
	pk			    INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	id			    INT NOT NULL GENERATED ALWAYS AS IDENTITY,
	db_id		    INT NOT NULL REFERENCES databases (id),
	db_version	    INT NOT NULL,
	time		    TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
	name		    TEXT NOT NULL,

	UNIQUE	        (id, db_id, db_version),
	UNIQUE		    (db_id, name)
);
```

## Partitions

A partition is a physical log file that belongs to a specific database instance
and is allocated to a node.

TODO To implement replication and failover we could arrange nodes in a ring. For
a given partition we pick one node as the primary. The next node on the ring is
replica 1 and the one after that replica n+1 etc. If one node fails we can
immediately go to the next one, etc. Would also need to implement write
consistency tracking to ensure that a transaction wrote to all replicas
successfully. And when a node comes back online it needs to syncronize with the
other nodes. Need to look into how other dbs do this...paxos? Any special
considerations for append-only and partition/aggregate scoped transactions?

TODO What happens when a partition is deleted?

```sql
CREATE TABLE partitions (
	id 				INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	uuid			UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    topic_id		INT NOT NULL REFERENCES topics (pk),
    node_id 		INT NOT NULL REFERENCES nodes (id)
)
```

## Partition Ring

The partition ring is a unit circle with a circumference covering the full range
of the `int` type. On the ring are points which reference a partition.

To locate the partition that a record belongs to we take the record's partition
key, hash it to a value in the range of the partition ring unit circle, and then
lookup the poing whose position is equal-to or greater-than that hash. The
partition referenced by that point is the record's parition.

TODO What happens when a point is deleted?

```sql
CREATE TABLE partition_ring (
	point 	        INT PRIMARY KEY,
    partition_id    INT NOT NULL REFERENCES partitions (id)
)
```