import { ConnectionError, ConnectionErrorCode } from "../../src/error";

test("ConenctionError has code", () => {
  const code: ConnectionErrorCode = ConnectionErrorCode.ER_CONN_TIMEOUT;
  const msg = "timeout";
  const err = new ConnectionError(msg, code);
  expect(err.code).toBe(code);
  expect(err.message).toBe(msg);
});
