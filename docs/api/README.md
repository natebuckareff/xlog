# API Overview

## Node

[Get nodes](node/get.md) : `GET /node`

[Get a node](node/uuid/get.md) : `GET /node/[uuid]`

[Create node](node/post.md) : `POST /node`

[Update node](node/uuid/put.md) : `PUT /node/[uuid]`

[Remove a node](node/uuid/delete.md) : `DELETE /node/[uuid]`

## Database

[Get databases](database/get.md) : `GET /database`

[Get a database](database/uuid/get.md) : `GET /database/[uuid]`

[Create database](database/post.md) : `POST /database`

[Delete a database](database/uuid/delete.md) : `DELETE /database/[uuid]`

## Database Partitions

[Get partitions](database/uuid/partition/get.md) : `GET /database/[uuid]/partition`

[Get a partition](database/uuid/partition/uuid/get.md) : `GET /database/[uuid]/partition/[uuid]`

[Create partition](database/uuid/partition/post.md) : `POST /database/[uuid]/partition`

## Partition Ring

[Find points](database/uuid/ring/get.md) : `GET /database/[uuid]/ring?point=<int>&partition=<uuid>`

[Create point](database/uuid/ring/post.md) : `POST /database/[uuid]/ring`

[Delete point](database/uuid/ring/point/delete.md) : `DELETE /database/[uuid]/ring/[point]`
