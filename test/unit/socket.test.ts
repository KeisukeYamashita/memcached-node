import { MemcachedSocket } from "../../src/socket";
import { Server } from "../../src/server";
import * as net from "net";

const server = new Server("localhost:11211");
let socket: net.Socket;

beforeAll(async () => {
  socket = net.connect({
    host: server.host,
    port: server.port,
  });
});

afterAll(async () => {
  socket.end();
});

test("memcached socket can construct instance", () => {
  const memSocket = new MemcachedSocket(socket, server);
  expect(memSocket.server).toEqual(server);
});

test("memcached socket can write data", async () => {
  const memSocket = new MemcachedSocket(socket, server);
  const input = "Hi, Memcached";
  const output = await new Promise((resolve) => {
    memSocket.on("data", (chunk: Buffer) => {
      resolve(chunk);
    });

    socket.emit("data", Buffer.from(input));
  });

  expect(output.toString()).toBe(input);
});
