import { EventEmitter } from "events";
import {
  Connection,
  ConnectionConfig,
  ConnectionOptions,
  defaultConnectionOptions,
  Status,
  StoreOptions,
  RetrieveOptions,
} from "./connection";
import { Response, StatsResponse } from "./response";
import { Server } from "./server";

import { ConnectionError, ConnectionErrorCode } from "./error";

export interface MemcachedOptions {
  poolSize: number;
  initSize: number;
  removeDeadServer: boolean;
  timeout: number;
  wait: boolean;
  waitTimeout: number;
}

export type Options = Partial<MemcachedOptions & ConnectionOptions>;

const defaultOptions: Options = {
  ...defaultConnectionOptions,
  initSize: 1,
  poolSize: 10,
  wait: false,
  waitTimeout: 3000,
};

export class Memcached extends EventEmitter {
  private _connectionId = 0;
  private _connectionConfig: ConnectionConfig;
  private _connectionPool: Connection[] = [];
  private _options: Options;

  constructor(args: ConnectionConfig, options?: Options) {
    super();
    this._connectionConfig = args;
    this._options = { ...defaultOptions, ...options };

    for (let i = 0; i < this._options.initSize; i++) {
      const connectionOptions = options as ConnectionOptions;
      const connection = new Connection(
        args,
        ++this._connectionId,
        connectionOptions
      );
      connection.on("close", (connection: Connection) =>
        this.emit("close", connection)
      );
      connection.on("drop", (connection: Connection, server: Server) =>
        this.emit("drop", connection, server)
      );
      this._connectionPool.push(connection);
    }
  }

  public clean(): void {
    this._connectionPool.forEach((connection) => {
      connection.close(true);
    });
  }

  public async createPool(): Promise<void[]> {
    const connTry = this._connectionPool.map((connection: Connection) => {
      return connection.connect(Status.IDLE);
    });

    return await Promise.all(connTry);
  }

  public getConnection(): Connection {
    if (this._connectionPool.length === 0) {
      const connection = new Connection(
        this._connectionConfig,
        ++this._connectionId
      );
      this._connectionPool.push(connection);
      return connection;
    }

    const idleConnections = this._getIdleConnections();
    if (idleConnections.length > 0) {
      const connection = idleConnections[0];
      connection.status = Status.RESEARVED;
      return idleConnections[0];
    }

    throw new ConnectionError(
      "no connection available",
      ConnectionErrorCode.ER_CONN_NO_AVAILABLE
    );
  }

  private _getIdleConnections(): Array<Connection> {
    return this._connectionPool.filter((connection: Connection) => {
      return connection.isIdle();
    });
  }

  private async _cmd<T>(
    fn: (connection?: Connection) => Promise<T>
  ): Promise<T> {
    let connection: Connection;
    if (this._options.wait) {
      connection = await this._getConnection();
    } else {
      connection = this.getConnection();
    }

    const resp = await fn(connection);
    connection.close();
    return resp;
  }

  private async _getConnection(): Promise<Connection> {
    try {
      return this.getConnection();
    } catch (err) {
      const connErr = err as ConnectionError;
      switch (connErr.code) {
        case ConnectionErrorCode.ER_CONN_NO_AVAILABLE:
          await new Promise((resolve, reject) => {
            this._connectionPool.forEach((conn: Connection) => {
              const timeout = setTimeout(() => {
                reject(
                  new ConnectionError(
                    "timout to get connection",
                    ConnectionErrorCode.ER_CONN_TIMEOUT
                  )
                );
              }, this._options.waitTimeout);

              conn.once("changeStatus", (id) => {
                const connection = this._connectionPool.find(
                  (conn: Connection) => {
                    return conn.id === id;
                  }
                );

                // this shouldn't happen
                if (!connection) {
                  throw err;
                }

                clearTimeout(timeout);
                connection.status = Status.RESEARVED;
                resolve(connection);
              });
            });
          });
          break;
      }

      throw connErr;
    }
  }

  public async createConnection(): Promise<Connection> {
    if (this._connectionPool.length >= this._options.poolSize) {
      throw new ConnectionError(
        "connection reached the pool size",
        ConnectionErrorCode.ER_CONN_MAX_CONNECTION
      );
    }

    const connectionOptions = this._options as ConnectionOptions;
    const connection = new Connection(
      this._connectionConfig,
      ++this._connectionId,
      connectionOptions
    );
    connection.on("close", (connection: Connection) =>
      this._handleClose(connection)
    );
    connection.on("drop", (connection: Connection, server: Server) =>
      this._handleDrop(connection, server)
    );
    this._connectionPool.push(connection);

    if (this._connectionPool.length === this._options.poolSize) {
      this.emit("maxConnection", this._options.poolSize);
    }

    return connection;
  }

  private _handleClose(removedConnection: Connection) {
    this._connectionPool = this._connectionPool.filter(
      (connection: Connection) => {
        return connection.id !== removedConnection.id;
      }
    );

    this.emit("close", removedConnection);
  }

  private _handleDrop(belongingConnection: Connection, server: Server) {
    this.emit("drop", belongingConnection, server);
  }

  public async get(
    keys: string | Array<string>,
    options?: RetrieveOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) => await connection.get(keys, options)
    );
  }

  public async gets(
    keys: string | Array<string>,
    options?: RetrieveOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) => await connection.gets(keys, options)
    );
  }

  public async set(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.set(key, value, options)
    );
  }

  public async add(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.add(key, value, options)
    );
  }

  public async append(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.append(key, value, options)
    );
  }

  public async prepend(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.prepend(key, value, options)
    );
  }

  public async replace(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.replace(key, value, options)
    );
  }

  public async cas(
    key: string,
    value: string | Record<string, any>,
    casId: number,
    options?: StoreOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.cas(key, value, casId, options)
    );
  }

  public async delete(key: string): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) => await connection.delete(key)
    );
  }

  public async gat(
    keys: string | Array<string>,
    expire: number,
    options?: RetrieveOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.gat(keys, expire, options)
    );
  }

  public async gats(
    keys: string | Array<string>,
    expire: number,
    options?: RetrieveOptions
  ): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) =>
        await connection.gats(keys, expire, options)
    );
  }

  public async touch(key: string, expires: number): Promise<Response> {
    return await this._cmd(
      async (connection: Connection) => await connection.touch(key, expires)
    );
  }

  public async stats(): Promise<StatsResponse> {
    return await this._cmd(
      async (connection: Connection) => await connection.stats()
    );
  }
}

export function createPool(
  args: ConnectionConfig,
  options?: MemcachedOptions
): Memcached {
  return new Memcached(args, options);
}
