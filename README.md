# memcached-node

[![Project status](https://img.shields.io/badge/Project%20status-under%20PoC-yellowgreen?style=flat-square)]()
[![npm version](https://badge.fury.io/js/memcached-node.svg)](https://badge.fury.io/js/memcached-node)
[![Test Package](https://github.com/KeisukeYamashita/memcached-node/workflows/Test%20Package/badge.svg)](https://github.com/KeisukeYamashita/memcached-node/actions?query=workflow%3A%22Test+Package%22)
[![codecov](https://codecov.io/gh/KeisukeYamashita/memcached-node/branch/master/graph/badge.svg)](https://codecov.io/gh/KeisukeYamashita/memcached-node)
[![Dependabot][dependabot-badge]][dependabot]
[![License](https://img.shields.io/badge/License-Apache%202.0-red?style=flat-square)](./LICENSE)

> A Promise-base Memcached client library for Node.js written in Typescript

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Install](#install)
- [Setting up the client](#setting-up-the-client)
- [Pooling connections vs Single connection](#pooling-connections-vs-single-connection)
  - [Serialize・Deserialize](#serialize%E3%83%BBdeserialize)
  - [0. String](#0-string)
  - [1. JSON](#1-json)
  - [Options](#options)
    - [MemcachedOptions: Options for Memcached](#memcachedoptions-options-for-memcached)
    - [ConnectionOptions: Options for each connection](#connectionoptions-options-for-each-connection)
- [API](#api)
  - [Methods](#methods)
    - [Memcached](#memcached)
      - [**.createPool**: Generates connections for the given server(s).](#createpool-generates-connections-for-the-given-servers)
      - [**.createConnection**: Generates a connection for given server(s).](#createconnection-generates-a-connection-for-given-servers)
      - [**.clean**: Close all connections in the pool](#clean-close-all-connections-in-the-pool)
      - [**.getConnection**: Get an idle connection](#getconnection-get-an-idle-connection)
    - [Connection](#connection)
      - [**.connect**: Generates connection for the given servers(s).](#connect-generates-connection-for-the-given-serverss)
      - [**.close**: Close the connection](#close-close-the-connection)
      - [**.isReady**: Check if the connection is ready to execute commands](#isready-check-if-the-connection-is-ready-to-execute-commands)
    - [**.remove**: Remove a server for the connection](#remove-remove-a-server-for-the-connection)
  - [Commands](#commands)
    - [Storage commmands](#storage-commmands)
      - [**{memcached,connection}.set**: Store the data](#memcachedconnectionset-store-the-data)
      - [**{memcached,connection}.add**: Store the data only if the server doesn't already hold data for this key](#memcachedconnectionadd-store-the-data-only-if-the-server-doesnt-already-hold-data-for-this-key)
      - [**{memcached,connection}.replace**: Store the data only if the server does hold data for this key](#memcachedconnectionreplace-store-the-data-only-if-the-server-does-hold-data-for-this-key)
      - [**{memcached,connection}.append**: Add the data to existing key after existing data](#memcachedconnectionappend-add-the-data-to-existing-key-after-existing-data)
      - [**{memcached,connection}.prepend**: Add the data to existing key before existing data](#memcachedconnectionprepend-add-the-data-to-existing-key-before-existing-data)
      - [**{memcached,connection}.cas**: Store the data only if no one elese has updated since I last fetched it](#memcachedconnectioncas-store-the-data-only-if-no-one-elese-has-updated-since-i-last-fetched-it)
    - [Retrieval commands](#retrieval-commands)
      - [**{memcached,connection}.get**: Get value for key(s)](#memcachedconnectionget-get-value-for-keys)
      - [**{memcached,connection}.gets**: Get value for key(s) using CAS](#memcachedconnectiongets-get-value-for-keys-using-cas)
    - [Deletion](#deletion)
      - [**{memcached,connection}.delete**: Delete the item by key](#memcachedconnectiondelete-delete-the-item-by-key)
    - [Touch](#touch)
      - [**{memcached,connection}.touch**: Update the expiration time of an exisiting item](#memcachedconnectiontouch-update-the-expiration-time-of-an-exisiting-item)
    - [Get and Touch](#get-and-touch)
      - [**{memcached,connection}.gat**: Get value for key(s) and update the expiration time](#memcachedconnectiongat-get-value-for-keys-and-update-the-expiration-time)
      - [**{memcached,connection}.gats**: Get value for key(s) and update the expiration time using CAS](#memcachedconnectiongats-get-value-for-keys-and-update-the-expiration-time-using-cas)
    - [Stats](#stats)
      - [**{memcached,connection}.stats**: Get the stats from your servers](#memcachedconnectionstats-get-the-stats-from-your-servers)
- [Event listening](#event-listening)
  - [Memcached](#memcached-1)
    - [`close`: When a connection is closed](#close-when-a-connection-is-closed)
    - [`drop`: When a server in the connection is closed](#drop-when-a-server-in-the-connection-is-closed)
    - [`maxConnection`: When the number of the connections in the connection pool reaches to poolsize](#maxconnection-when-the-number-of-the-connections-in-the-connection-pool-reaches-to-poolsize)
  - [Connection](#connection-1)
    - [`close`: When all server is droped is closed](#close-when-all-server-is-droped-is-closed)
    - [`drop`: When a server in the connection is removed](#drop-when-a-server-in-the-connection-is-removed)
- [Authentication](#authentication)
- [Contribution](#contribution)
- [Author](#author)
- [LICENSE](#license)
- [Other libraries](#other-libraries)
- [Futher readings](#futher-readings)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Install

```console
$ npm install memcached-node
```

or 

```console
$ yarn add memcached-node
```

## Setting up the client

```typescript
import {Memcached} from 'memcached-node'

let memcached = new Memcached('localhost:11211')
```

You can either use these types for configuring the servers.

1. **String**: For single running instance.
2. **Array**: For cluster of Memcached servers.
3. **Object**: For cluster of Memcached servers with user options. See details of the Options for detail.

```typescript
// 1. String
let memcached = new Memcached('localhost:11211')

// 2. Array
let memcached = new Memcached(['localhost:11211', 'localhost:11212'])

// 3. Object
let memcached = new Memcached({
    'localhost:11211': 200,
    'localhost:11212': {
        weight: 200
    },
    'localhost: 11213': {
        vnode: 400,
        timeout: 300
    }
})
```

## Pooling connections vs Single connection

You can use either connection pool or connection.

```typescript
let memcached = new Memcached('localhost:11211')
await memcached.createPool()
await memcached.get('keke')

// or use single connection

let connection = Memcached.createConnection('localhost:11211')
await connection.connect()
await connection.get('keke')
```

Because the connection will take cost, I recommend to use the connection pool and share the connection between clients.
Each time, you run a command by `Memcached` method, it will grab a idle connection and release it after the command is done.

### Serialize・Deserialize

You can use raw string inputs(default) or 3 ways to serialize・deserialize.

### 0. String

```typescript
const resp = await connection.set("key", "value")
```

### 1. JSON

```typescript
const json = {
  value: "hello"
}

const resp = await connection.set("key", json, {mode:"json"})
```

### Options

#### MemcachedOptions: Options for Memcached

* `initSize`: **1**, the size of the init connection.
* `poolSize`: **10**, maximun size of the connection pool.
* `removeDeadServer`: **true**, remove if the server is dead or closed.
* `wait`: **false**, if wait to get connection available.
* `waitTimeout`: **1000**, the time to wait for available connection.

#### ConnectionOptions: Options for each connection

* `basicAuth`: **undefined**, username/password authentication. See the details in `Authentication` section. 
* `timeout`: **3000**, the time after which Memcached sends a connection timeout(in milliseconds).
* `vnode`: **undefined**, Virtual node in the hashring.
* `weight`: **undefined**, the weight of the node in the hashring.

## API

### Methods

These are essential methods that you should know when operating with `memcached`.

#### Memcached

##### **.createPool**: Generates connections for the given server(s).

Connect to the servers given when instanting.

```typescript
await memcached.createPool()
```

##### **.createConnection**: Generates a connection for given server(s).

```typescript
let connection = await memcached.createConnection()
```

If you want to create a connection directly without using the connection pool, use `Connection.createConnection()`.

##### **.clean**: Close all connections in the pool

Close all connections to the given servers.

```typescript
memcached.clean()
```

##### **.getConnection**: Get an idle connection

```typescript
let connection = memcached.getConnection()
```

Don't forget to `.close()` your connection after you finish your execution. 

#### Connection

##### **.connect**: Generates connection for the given servers(s).

```typescript
await connection.connect()
```

##### **.close**: Close the connection

```typescript
connection.close()
```

##### **.isReady**: Check if the connection is ready to execute commands

```typescript
let isReady = connection.isReady()
```

#### **.remove**: Remove a server for the connection

```typescript
connection.remove('localhost:11211')
```

### Commands

These are API's that both `Memcached` and `Connection` uses.

#### Storage commmands

These are command to store an item. Replace `memcached` to `connection` if you are running the method on a connection.

##### **{memcached,connection}.set**: Store the data

```typescript
let resp = await memcached.set('keke', 'pupu')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

##### **{memcached,connection}.add**: Store the data only if the server doesn't already hold data for this key

```typescript
let resp = await memcached.add('keke', 'pupu')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

##### **{memcached,connection}.replace**: Store the data only if the server does hold data for this key

```typescript
let resp = await memcached.replace('keke', 'pupu')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

##### **{memcached,connection}.append**: Add the data to existing key after existing data

```typescript
let resp = await memcached.append('keke', 'pupu')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

##### **{memcached,connection}.prepend**: Add the data to existing key before existing data

```typescript
let resp = await memcached.prepend('keke', 'pupu')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

##### **{memcached,connection}.cas**: Store the data only if no one elese has updated since I last fetched it

```typescript
let resp = await memcached.cas('keke', 'id')
```

Also you can pass these arguments too.

* Compressed: **boolean**.
* Expiration time: **number**.

#### Retrieval commands

These are command to restrieve an item.

##### **{memcached,connection}.get**: Get value for key(s)

```typescript
var resp = await memcached.get('hoge')
var resp = await memcached.get(['hoge'])
```

##### **{memcached,connection}.gets**: Get value for key(s) using CAS

```typescript
var resp = await memcached.gets('hoge')
var resp = await memcached.gets(['hoge'])
```

#### Deletion

##### **{memcached,connection}.delete**: Delete the item by key

```typescript
let resp = await memcached.delete(['hoge'])
```

#### Touch

##### **{memcached,connection}.touch**: Update the expiration time of an exisiting item

```typescript
let resp = await memcached.touch(['hoge'])
```

Also you can pass these arguments too.

* Expiration time: **number**.

#### Get and Touch

##### **{memcached,connection}.gat**: Get value for key(s) and update the expiration time

```typescript
let resp = await memcached.gat(['hoge'])
```

##### **{memcached,connection}.gats**: Get value for key(s) and update the expiration time using CAS

```typescript
let resp = await memcached.gats(['hoge'])
```

#### Stats

##### **{memcached,connection}.stats**: Get the stats from your servers

Get stats of your server.

```typescript
let resp = await memcached.stats()
```

## Event listening

These are useful events that will be emited when specific event happens on the connection.

### Memcached

#### `close`: When a connection is closed

Emitted when a socket connecting or connection has an error.

Arguments:

* `Connection`: the connection which closed in the connection pool
* `Server`: the server which droped last

```typescript
memcached.on('close', (connection, server) => {
    console.log(`Connection closed: error: ${err}, url: ${server.url}`)
})
```

#### `drop`: When a server in the connection is closed

```typescript
memcached.on('drop', (connection: Connection, server: Server) => {
  console.log(`server ${server.url} is droped`)
})
```

#### `maxConnection`: When the number of the connections in the connection pool reaches to poolsize

```typescript
memcached.on('maxConnection', (poolsize: number) => {
  console.log(`connection reached the poolsize: ${poolsize}`)
})
```
Note that this event will note be triggered when memcached initialization.

### Connection

#### `close`: When all server is droped is closed

```typescript
connection.on('close', (connection:Connection) => {
  console.log('all server in the connection is closed')
})
```

#### `drop`: When a server in the connection is removed

```typescript
connection.on('drop', (connection: Connection, server: Server) => {
  console.log(`server ${server.url} is droped`)
})
```

## Authentication

Memcached supports username/password authentications. When initializing the Memcached, pass the basicAuth option.

```typescript
let memcached = new Memcached({
    'localhost:11211': {
        basicAuth: {
            username: 'keke',
            password: 'piyo'
        }
    },
    'localhost:11212': {
        basicAuth: {
            username: 'keke',
            password: 'huga'
        }
    }
})
```

## Contribution

I welcome and contribution. Please open an Issue or a Pull Request.

Creating an Issue before sending a Pull request is desirable so make sure that the implementation is surely needed. Thank you in advance.

## Author

* [KeisukeYamashita](https://github.com/KeisukeYamashita)

## LICENSE

The driver is released under the Apache 2.0 license. See the [LICENSE](./LICENSE) for more information.

## Other libraries

List of other memcached JS libraries(2020/04/20).

| Repository | stars | Notes
|:----:|:----:|:---:|
|  [3rd-Eden/memcached](https://github.com/3rd-Eden/memcached)  | 1.2k  | Defacto standard memcached library | 
| [electrode-io/memcache](https://github.com/electrode-io/memcache)  | 21  | From Facebook |
| [googleapi/nodejs-memcache](https://github.com/googleapis/nodejs-memcache) | 4 | From Google. Born in 2020/04/01 | 

## Futher readings

* [memcached/protocol.txt](https://github.com/memcached/memcached/blob/master/doc/protocol.txt)
    * Official memcached protocol document

<!--badge links-->
[dependabot]: https://dependabot.com 
[dependabot-badge]: https://badgen.net/badge/icon/Dependabot?icon=dependabot&label&color=blue
<!--  -->