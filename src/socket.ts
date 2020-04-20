import * as net from "net";
import { EventEmitter } from "events";
import { Server } from "./server";

export interface ISocket {
  write(buffer: Buffer): void;
  end(): void;
  remove(): void;
}

export class MemcachedSocket extends EventEmitter implements ISocket {
  private _socket: net.Socket;
  public server: Server;

  constructor(socket: net.Socket, server: Server) {
    super();
    this._socket = socket;
    this.server = server;
    this._socket.on("error", (err: Error) => {
      this.emit("error", err);
    });
    this._socket.on("timeout", () => this.emit("timeout"));
    this._socket.on("close", () => this.emit("close"));
    this._socket.on("connect", () => this.emit("connect"));
    this._socket.on("data", (chunk: Buffer) => this.emit("data", chunk));
  }

  public async write(buffer: Uint8Array | string) {
    this._socket.write(buffer);
  }

  public end() {
    this._socket.end();
  }

  public remove() {
    this._socket.removeAllListeners("error");
    this._socket.removeAllListeners("timeout");
    this._socket.removeAllListeners("connect");
    this._socket.removeAllListeners("close");
    this._socket.removeAllListeners("data");
  }
}
