import * as net from "net";
import { EventEmitter } from "events";
import { queue, AsyncQueue } from "async";
import {
  parseResponseCode,
  parseResponse,
  parseStatResponse,
  Response,
  ResponseCode,
  Stats,
  StatsResponse,
} from "./response";
import { Server, ServerConfigs, ServerConfig } from "./server";
import { MemcachedSocket } from "./socket";
import * as Hashring from "hashring";
import { ConnectionError, ConnectionErrorCode } from "./error";

type TaskQueue = {
  commands: Array<string>;
  callback: Function;
  location: string;
};

export enum Status {
  INIT = "INIT",
  CONNECTING = "CONNECTING",
  IDLE = "IDLE",
  RESEARVED = "RESEARVED",
  CLOSE = "CLOSE",
}

export interface ConnectionOptions {
  mode: modes;
  timeout: number;
  removeDeadServer: boolean;
  retry: boolean;
  retryLimit: number;
  exponentialBackoff: boolean;
}

export type ConnectionConfig = string | Array<string> | ServerConfigs;

export const defaultConnectionOptions: Partial<ConnectionOptions> = {
  mode: "json",
  removeDeadServer: true,
  timeout: 3000,
  retry: true,
  retryLimit: 10,
  exponentialBackoff: true,
};

type modes = "string" | "json";

export interface StoreOptions {
  isCompressed?: boolean;
  expires?: number;
  mode?: modes;
}

const defaultStoreoptions: StoreOptions = {
  isCompressed: false,
  expires: 0,
  mode: "string",
};

export interface RetrieveOptions {
  mode?: modes;
}

const defaultRetriveoptions: RetrieveOptions = {
  mode: "string",
};

export class Connection extends EventEmitter {
  public status: Status;
  public id = 0;
  private _servers: Array<Server> = [];
  private _sockets: Array<MemcachedSocket> = [];
  private _queue: AsyncQueue<any>;
  private _hashring: Hashring;
  private _options: ConnectionOptions;

  constructor(
    args: ConnectionConfig,
    id = 0,
    options?: Partial<ConnectionOptions>
  ) {
    super();
    this.status = Status.INIT;
    this.id = id;
    let servers = [];
    switch (Object.prototype.toString.call(args)) {
      case "[object Object]":
        const serverConfig = args as ServerConfigs;
        for (const url in serverConfig) {
          const serverOptions = serverConfig[url] as ServerConfig;
          servers.push(new Server(url, serverOptions));
        }
        break;
      case "[object Array]":
        servers = (args as string[]).map((url: string) => {
          return new Server(url);
        });
        break;
      default:
        const url = args as string;
        servers = [new Server(url)];
        break;
    }

    this._options = {
      ...defaultConnectionOptions,
      ...options,
    } as ConnectionOptions;
    this._servers = servers;
    this._hashring = new Hashring(servers);
    this._queue = queue(async (task: TaskQueue, errCallBack) => {
      const url = task.location;
      const socket = this._sockets.find((socket: MemcachedSocket) => {
        return socket.server.url === url;
      });

      if (!socket) {
        const err = new ConnectionError(
          `no socket found for ${url}`,
          ConnectionErrorCode.ER_CONN_SOCKET_NOT_FOUND
        );
        errCallBack(err);
        return;
      }

      const readData = (chunk: Buffer) => {
        if (socket) {
          socket.removeListener("data", readData);
        }

        task.callback(chunk);
        errCallBack(null);
      };

      socket.on("data", readData);
      if (socket) {
        for (const command of task.commands) {
          const fn = () => {
            socket.write(Buffer.from(command, "utf8"));
            socket.write(`\r\n`);
          };

          if (this._options.retry) {
            await this._retry(fn, this._options.retryLimit);
          } else {
            fn();
          }
        }
      }
    });
  }

  public async connect(status?: Status): Promise<void> {
    this.status = Status.CONNECTING;
    const sockets = this._servers.map((server: Server) => {
      return this._connect(server, status);
    });

    await Promise.all(sockets);
  }

  public join(args: ConnectionConfig) {
    if (this.status === Status.CLOSE) {
      throw new ConnectionError(
        "connection can't be added to close connection",
        ConnectionErrorCode.ER_CONN_CLOSED
      );
    }

    let servers: Array<Server> = [];
    switch (Object.prototype.toString.call(args)) {
      case "[object Object]":
        const serverConfig = args as ServerConfigs;
        for (const url in serverConfig) {
          const serverOptions = serverConfig[url] as ServerConfig;
          servers.push(new Server(url, serverOptions));
        }
        break;
      case "[object Array]":
        servers = (args as string[]).map((url: string) => {
          return new Server(url);
        });
        break;
      default:
        const url = args as string;
        servers = [new Server(url)];
        break;
    }

    this._servers.push(...servers);
    servers.forEach((server) => {
      this._hashring.add(server.url);
    });
  }

  public close(force?: boolean): void {
    // Memo(KeisukeYamashita):
    //
    // If the connection belongs to a connection pool,
    // make it to idle status for pooling.
    if (this.status !== Status.IDLE && this.status !== Status.RESEARVED) {
      throw new ConnectionError(
        "can't close not open connection",
        ConnectionErrorCode.ER_CONN_NOT_OPEN
      );
    }

    if (this.id !== 0) {
      this._setStatus(force ? Status.CLOSE : Status.IDLE);
      return;
    }

    this._sockets.forEach((socket: MemcachedSocket) => {
      socket.remove();
      socket.end();
    });

    this._setStatus(Status.CLOSE);
    this._hashring.end();
  }

  public isReady(): boolean {
    return this.status === Status.IDLE || this.status === Status.RESEARVED;
  }

  public isIdle(): boolean {
    return this.status === Status.IDLE;
  }

  public async get(
    keys: string | Array<string>,
    options?: RetrieveOptions
  ): Promise<Response> {
    options = { ...defaultRetriveoptions, ...options };
    if (typeof keys === "string") {
      keys = [keys];
    }

    const resps = await Promise.all(
      keys.map(async (key) => {
        const command = `get ${key}`;
        const location = this._hashring.get(key);
        const resp = await this._cmd("get", [command], location);
        switch (resp.code) {
          case ResponseCode.ERROR:
          case ResponseCode.SERVER_ERROR:
          case ResponseCode.CLIENT_ERROR:
            throw new Error("error");
          default:
            return this._deserialize(options.mode, resp);
        }
      })
    );

    return this._mergeMultiGet(resps);
  }

  public async gets(
    keys: string | Array<string>,
    options?: RetrieveOptions
  ): Promise<Response> {
    options = { ...defaultRetriveoptions, ...options };
    if (typeof keys === "string") {
      keys = [keys];
    }

    const resps = await Promise.all(
      keys.map(async (key) => {
        const command = `gets ${key}`;
        const location = this._hashring.get(key);
        const resp = await this._cmd("gets", [command], location);
        switch (resp.code) {
          case ResponseCode.ERROR:
          case ResponseCode.SERVER_ERROR:
          case ResponseCode.CLIENT_ERROR:
            throw new Error("error");
          default:
            return this._deserialize(options.mode, resp);
        }
      })
    );

    return this._mergeMultiGet(resps);
  }

  public async set(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `set ${key} ${options?.isCompressed ? 1 : 0} ${
      options?.expires
    } ${byteSize}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd("set", [command, serializedValue], location);

    switch (resp.code) {
      case ResponseCode.EXISTS:
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async add(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `add ${key} ${options.isCompressed ? 1 : 0} ${
      options.expires
    } ${byteSize}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd("add", [command, serializedValue], location);

    switch (resp.code) {
      case ResponseCode.EXISTS:
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async append(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `append ${key} ${options.isCompressed ? 1 : 0} ${
      options.expires
    } ${byteSize}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd(
      "append",
      [command, serializedValue],
      location
    );

    switch (resp.code) {
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async prepend(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `prepend ${key} ${options.isCompressed ? 1 : 0} ${
      options.expires
    } ${byteSize}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd(
      "prepend",
      [command, serializedValue],
      location
    );

    switch (resp.code) {
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async replace(
    key: string,
    value: string | Record<string, any>,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `replace ${key} ${options.isCompressed ? 1 : 0} ${
      options.expires
    } ${byteSize}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd(
      "replace",
      [command, serializedValue],
      location
    );

    switch (resp.code) {
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return this._deserialize(options.mode, resp);
      default:
        throw new Error("error");
    }
  }

  public async cas(
    key: string,
    value: string | Record<string, any>,
    casId: number,
    options?: StoreOptions
  ): Promise<Response> {
    options = { ...defaultStoreoptions, ...options };
    const serializedValue = this._serialize(options?.mode, value);
    const byteSize = Buffer.byteLength(serializedValue, "utf8");
    const command = `cas ${key} ${options.isCompressed ? 1 : 0} ${
      options.expires
    } ${byteSize} ${casId}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd("cas", [command, serializedValue], location);

    switch (resp.code) {
      case ResponseCode.EXISTS:
      case ResponseCode.STORED:
      case ResponseCode.NOT_STORED:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async gat(
    keys: string | Array<string>,
    expire: number,
    options?: RetrieveOptions
  ): Promise<Response> {
    options = { ...defaultRetriveoptions, ...options };
    if (typeof keys === "string") {
      keys = [keys];
    }

    const resps = await Promise.all(
      keys.map(async (key) => {
        const command = `gat ${expire} ${key}`;
        const location = this._hashring.get(key);
        const resp = await this._cmd("gat", [command], location);
        switch (resp.code) {
          case ResponseCode.ERROR:
          case ResponseCode.SERVER_ERROR:
          case ResponseCode.CLIENT_ERROR:
            throw new Error("error");
          default:
            return this._deserialize(options.mode, resp);
        }
      })
    );

    return this._mergeMultiGet(resps);
  }

  public async gats(
    keys: string | Array<string>,
    expire: number,
    options?: RetrieveOptions
  ): Promise<Response> {
    options = { ...defaultRetriveoptions, ...options };
    if (typeof keys === "string") {
      keys = [keys];
    }

    const resps = await Promise.all(
      keys.map(async (key) => {
        const command = `gats ${expire} ${key}`;
        const location = this._hashring.get(key);
        const resp = await this._cmd("gats", [command], location);
        switch (resp.code) {
          case ResponseCode.ERROR:
          case ResponseCode.SERVER_ERROR:
          case ResponseCode.CLIENT_ERROR:
            throw new Error("error");
          default:
            return this._deserialize(options.mode, resp);
        }
      })
    );

    return this._mergeMultiGet(resps);
  }

  public async delete(key: string): Promise<Response> {
    const command = `delete ${key}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd("delete", [command], location);

    switch (resp.code) {
      case ResponseCode.DELETED:
      case ResponseCode.NOT_FOUND:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public remove(url: string) {
    this._hashring.remove(url);

    if (this._sockets.length === 0) {
      this._setStatus(Status.CLOSE);
      this.emit("close", this);
    }
  }

  public async touch(key: string, expire: number): Promise<Response> {
    const command = `touch ${key} ${expire}`;
    const location = this._hashring.get(key);
    const resp = await this._cmd("touch", [command], location);

    switch (resp.code) {
      case ResponseCode.TOUCHED:
      case ResponseCode.NOT_FOUND:
        return resp;
      default:
        throw new Error("error");
    }
  }

  public async stats(): Promise<StatsResponse> {
    const command = "stats";
    const results = await Promise.all(
      this._servers.map(async (server: Server) => {
        const location = server.url;
        const resp = await this._cmd(command, [command], location);
        return { location, resp };
      })
    );

    const resp: StatsResponse = {
      code: ResponseCode.END,
      stats: {},
    };

    results.forEach((r) => {
      switch (r.resp.code) {
        case ResponseCode.END:
          break;
        default:
          throw new Error("error");
      }
      const statsu = r.resp.stats as Stats;
      resp.stats[r.location] = statsu;
    });

    return resp;
  }

  private async _connect(server: Server, status?: Status): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectOptions: net.NetConnectOpts = {
        host: server.host,
        port: server.port,
        timeout: this._options.timeout,
      };

      const socket = net.connect(connectOptions);
      const memSocket = new MemcachedSocket(socket, server);
      memSocket.on("error", (err: Error) => {
        reject(err);
        if (this.listeners("error").length > 0) {
          this.emit("error", err, server);
        }
      });
      memSocket.on("timeout", () => {
        reject(
          new ConnectionError("timeout", ConnectionErrorCode.ER_CONN_TIMEOUT)
        );
        if (this.listeners("timeout").length > 0) {
          this.emit("timeout", server);
        }
      });
      memSocket.on("close", () => this._handleSocketClose(server));
      memSocket.on("connect", () => {
        this._setStatus(status || Status.RESEARVED);
        this._sockets.push(memSocket);
        resolve();
      });
    });
  }

  private async _cmd(
    command: string,
    commands: Array<string>,
    location: string
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      this._queue.push(
        {
          commands: commands,
          location: location,
          callback: (chunk: Buffer) => {
            const code = parseResponseCode(chunk);
            if (command === "stats") {
              const stats = parseStatResponse(chunk);
              resolve({ code, stats });
              return;
            }

            const data = parseResponse(chunk);
            resolve({ code, data });
          },
        } as TaskQueue,
        (err) => {
          if (err) reject(err);
        }
      );
    });
  }

  private _handleSocketClose(server: Server) {
    this._remove(server);

    if (this._sockets.length === 0) {
      this._setStatus(Status.CLOSE);
      if (this.listeners("close").length > 0) {
        this.emit("close", this);
      }
    }
  }

  private _mergeMultiGet(resps: Response[]): Response {
    const result: Response = {
      code: ResponseCode.END,
      data: {},
    };

    resps.forEach((resp) => {
      if (resp.code !== ResponseCode.END) {
        throw new Error("not all end with END");
      }

      Object.keys(resp.data).forEach((key) => {
        const value = resp.data[key];
        result.data[key] = value;
      });
    });

    return result;
  }

  // Connection's internal remove will emit the 'drop' event
  private _remove(server: string | Server) {
    let url: string;
    if (typeof server === "string") {
      url = server;
    } else {
      url = server.url;
    }

    if (this._options.removeDeadServer) {
      this._hashring.remove(url);
      this._sockets = this._sockets.filter((socket: MemcachedSocket) => {
        return socket.server.url !== url;
      });
      if (this.listeners("drop").length > 0) {
        this.emit("drop", this, server);
      }
    }
  }

  private async _retry<T>(
    fn: () => T | Promise<T>,
    retryLimit: number
  ): Promise<T> {
    let attemp = 0;
    let err: Error;
    const wait = (attempt?: number) => {
      const waitSec = this._options.exponentialBackoff
        ? () => {
            return 100;
          }
        : (attempt: number) => {
            return Math.pow(2, attempt);
          };

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, waitSec(attempt));
      });
    };

    while (true) {
      if (attemp >= retryLimit) {
        throw err;
      }

      try {
        return await fn();
      } catch (funcErr) {
        err = funcErr;
        await wait();
        attemp++;
      }
    }
  }

  private _serialize(
    mode: modes = "string",
    value: string | Record<string, any>
  ): string {
    if (mode === "string" && typeof value === "string") {
      return value;
    }

    switch (mode) {
      case "json":
        return JSON.stringify(value);
      default:
        throw new Error(`not supported serialize mode ${mode} with Objects`);
    }
  }

  private _deserialize(mode: modes = "string", resp: Response): Response {
    if (mode === "string") {
      return resp;
    }

    Object.keys(resp.data).forEach((key: string) => {
      const data = resp.data[key];
      let value;

      switch (mode) {
        case "json":
          value = JSON.parse(data.value as string);
          break;
        default:
          throw new Error(`not supported serialize mode ${mode} with Objects`);
      }

      resp.data[key].value = value;
    });

    return resp;
  }

  private _setStatus(newStatus: Status) {
    const oldStatus = this.status;
    this.status = newStatus;
    if (this.listeners("changeStatus").length > 0) {
      this.emit("changeStatus", this.id, newStatus, oldStatus);
    }
  }
}

export function createConnection(
  args: ConnectionConfig,
  options?: ConnectionOptions
): Connection {
  return new Connection(args, 0, options);
}
