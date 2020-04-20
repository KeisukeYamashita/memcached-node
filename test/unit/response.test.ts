import { parseResponseCode, ResponseCode } from "../../src/response";

const setResp = `STORED\r\n`;

const getResp = `VALUE hoge 0 4\r\nkoko\r\nEND\r\n`;
const getUnexistingKeyResp = `END\r\n`;
const statsResp = `stats items\r\nSTAT pid 1\r\nSTAT uptime 19\r\nSTAT version 0\r\nSTAT time 0\r\nSTAT libevent 0\r\nSTAT pointer_size 0\r\nEND\r\n`;

describe("parseResponseCode", () => {
  const testcases = {
    set: {
      input: setResp,
      status: ResponseCode.STORED,
    },
    get: {
      input: getResp,
      status: ResponseCode.END,
    },
    "get unexisting key": {
      input: getUnexistingKeyResp,
      status: ResponseCode.END,
    },
  };

  it("can return response code", () => {
    Object.keys(testcases).forEach((key) => {
      const testcase = testcases[key];
      const code = parseResponseCode(Buffer.from(testcase.input));
      expect(code).toBe(testcase.status);
    });
  });
});

describe("parseStatResponse", () => {
  const testcases = {
    stats: {
      input: statsResp,
      status: ResponseCode.END,
    },
  };

  it("can return response code", () => {
    Object.keys(testcases).forEach((key) => {
      const testcase = testcases[key];
      const code = parseResponseCode(Buffer.from(testcase.input));
      expect(code).toBe(testcase.status);
    });
  });
});
