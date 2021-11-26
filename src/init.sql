CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE nodes (
    id          UUID DEFAULT uuid_generate_v1mc() PRIMARY KEY,
    hostname    TEXT NOT NULL,
    port        INT NOT NULL,
    cpus        INT NOT NULL,

    UNIQUE (hostname, port)
);

CREATE TABLE databases (
    id          UUID DEFAULT uuid_generate_v1mc() PRIMARY KEY,
    version     INT NOT NULL,
    name        TEXT NOT NULL UNIQUE
    -- deleted     BOOLEAN NOT NULL
);

CREATE TABLE attributes (
    pk              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id              UUID DEFAULT uuid_generate_v1mc(),
    db_id           UUID NOT NULL REFERENCES databases (id),    
    db_version      INT NOT NULL,
    time            TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    name            TEXT NOT NULL,
    handler_id      UUID NOT NULL,
    is_unique       BOOLEAN NOT NULL,
    -- deleted     BOOLEAN NOT NULL,

    UNIQUE          (id, db_id, db_version)
);

CREATE TABLE topics (
    pk              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id              UUID DEFAULT uuid_generate_v1mc(),
    db_id           UUID NOT NULL REFERENCES databases (id),
    db_version      INT NOT NULL,
    time            TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    name            TEXT NOT NULL,
    -- deleted     BOOLEAN NOT NULL,

    UNIQUE          (id, db_id, db_version)
);

CREATE TABLE partitions (
    pk              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id              UUID DEFAULT uuid_generate_v1mc(),
    db_id           UUID NOT NULL REFERENCES databases (id),
    db_version      INT NOT NULL,
    time            TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    topic_id        INT NOT NULL REFERENCES topics (pk),
    node_id         UUID NOT NULL REFERENCES nodes (id)
    -- unique_id       INT REFERENCES attributes (pk)
);

CREATE TABLE partition_ring (
    point           INT PRIMARY KEY,
    partition_pk    INT NOT NULL REFERENCES partitions (pk)
);