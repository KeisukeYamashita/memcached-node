import { Server } from "../../src/server";

const testHost = "localhost";
const testPort = 11211;
const testUrl = `${testHost}:${testPort}`;

test("server can configure properties", () => {
  const server = new Server(testUrl);
  expect(server.host).toBe(testHost);
  expect(server.port).toBe(testPort);
  expect(server.url).toBe(testUrl);
});
