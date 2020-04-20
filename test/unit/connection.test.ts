import {
  Connection,
  ConnectionConfig,
  Status,
  createConnection,
} from "../../src/connection";
import { ConnectionError, ConnectionErrorCode } from "../../src/error";
import { v4 as uuidv4 } from "uuid";
import { ResponseCode } from "../../src/response";
import { TestValue } from "../unit/_index";

const config: ConnectionConfig = {
  "localhost:11211": {},
  "localhost:11212": {},
  "localhost:11213": {},
};

const badUrl = "localhost:11500";

const urls = Object.keys(config);

let connection: Connection;

beforeEach(() => {
  connection = new Connection(config);
});

describe("Connection", () => {
  describe("connect()", () => {
    it("can connect to all servers", async () => {
      await connection.connect();
    });

    describe("when bad server", () => {
      it("should return err", async () => {
        const badConn = new Connection(badUrl);
        expect.assertions(1);
        try {
          await badConn.connect();
        } catch (err) {
          expect(err).toBeDefined();
        }
      });
    });
  });

  describe("close()", () => {
    describe("force", () => {
      it("can CLOSE connction", () => {
        connection.status = Status.RESEARVED;
        connection.close();
        expect(connection.status).toBe(Status.CLOSE);
      });
    });

    describe("when belongs to pool", () => {
      describe("force", () => {
        it("can CLOSE connection", () => {
          connection.status = Status.RESEARVED;
          connection.id = 1; // Belongs to cool
          connection.close(true);
          expect(connection.status).toBe(Status.CLOSE);
        });

        it("can IDLE connection", () => {
          connection.status = Status.RESEARVED;
          connection.id = 1; // Belongs to cool
          connection.close();
          expect(connection.status).toBe(Status.IDLE);
        });

        it("throw error for not opened connection", () => {
          expect(() => connection.close()).toThrowError();
        });
      });
    });
  });

  describe("constructor", () => {
    it("can instance by single server", () => {
      const url = urls[0];
      try {
        const _ = new Connection(url);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it("can instance by array of servers", () => {
      try {
        const _ = new Connection(urls);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it("can instace by connection congurations", () => {
      try {
        const _ = new Connection(config);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });
  });

  describe("join()", () => {
    it("can instance by single server", () => {
      connection.join(urls[0]);
    });

    it("can instance by array of servers", () => {
      connection.join(urls);
    });

    it("can instance by single server", () => {
      connection.join(config);
    });

    it("throws error when the connection is close", () => {
      connection.status = Status.CLOSE;
      expect.assertions(1);
      try {
        connection.join(config);
      } catch (e) {
        const connErr = e as ConnectionError;
        expect(connErr.code).toBe(ConnectionErrorCode.ER_CONN_CLOSED);
      }
    });
  });

  describe("isReady()", () => {
    it("false when initial connected", () => {
      expect(connection.isReady()).toBe(false);
    });

    it("false when not ready status", () => {
      [Status.INIT, Status.CONNECTING, Status.CLOSE].forEach((status) => {
        connection.status = status;
        expect(connection.isReady()).toBe(false);
      });
    });

    it("true when ready", () => {
      [Status.IDLE, Status.RESEARVED].forEach((status) => {
        connection.status = status;
        expect(connection.isReady()).toBe(true);
      });
    });
  });

  describe("isIdle()", () => {
    it("false when init", () => {
      expect(connection.isIdle()).toBe(false);
    });

    it("false when not idle status", () => {
      [Status.INIT, Status.CONNECTING, Status.CLOSE, Status.RESEARVED].forEach(
        (status) => {
          connection.status = status;
          expect(connection.isIdle()).toBe(false);
        }
      );
    });

    it("true when idle", () => {
      connection.status = Status.IDLE;
      expect(connection.isIdle()).toBe(true);
    });
  });

  describe("remove()", () => {
    it("can remove specifies url and close", () => {
      urls.forEach((url) => {
        connection.remove(url);
      });

      expect(connection.status).toBe(Status.CLOSE);
    });
  });

  describe("commands", () => {
    beforeEach(async () => {
      await connection.connect();
    });

    afterEach(() => {
      connection.close();
    });

    describe("get()", () => {
      describe("when no item exists", () => {
        describe("with single key", () => {
          it("should return with empty data", async () => {
            const testKey = uuidv4();
            const resp = await connection.get(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            expect(resp.data[testKey]).toBeUndefined();
          });

          it("should success with many times", async () => {
            const testKey = uuidv4();
            const resp = await connection.get(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            const resp2 = await connection.get(testKey);
            expect(resp2.code).toBe(ResponseCode.END);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await connection.get(testKeys);
            expect(resp.code).toBe(ResponseCode.END);
            testKeys.forEach((key) => {
              expect(resp.data[key]).toBeUndefined();
            });
          });
        });

        describe("with JSON object", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };

            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when item exists", () => {
        describe("with string", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            expect(getResp.data[testKey].casId).toBeUndefined();
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const testValue = uuidv4();
            await Promise.all(
              testKeys.map(async (key) => {
                const setResp = await connection.set(key, testValue);
                expect(setResp.code).toBe(ResponseCode.STORED);
              })
            );
            const getsResp = await connection.gets(testKeys);
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data).toBeDefined();
            testKeys.forEach((key) => {
              expect(getsResp.data[key]).toBeDefined();
            });
          });
        });

        describe("with JSON object", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };

            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
          });
        });
      });
    });

    describe("gets()", () => {
      describe("when no item exists", () => {
        describe("with single key", () => {
          it("should return with empty data", async () => {
            const testKey = uuidv4();
            const resp = await connection.gets(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            expect(resp.data[testKey]).toBeUndefined();
          });

          it("should success with many times", async () => {
            const testKey = uuidv4();
            const resp = await connection.gets(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            const resp2 = await connection.gets(testKey);
            expect(resp2.code).toBe(ResponseCode.END);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await connection.gets(testKeys);
            expect(resp.code).toBe(ResponseCode.END);
            testKeys.forEach((key) => {
              expect(resp.data[key]).toBeUndefined();
            });
          });
        });

        describe("with JSON object", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };

            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await connection.gets(testKey, { mode: "json" });
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data[testKey].value).toStrictEqual(testValue);
            expect(getsResp.data[testKey].casId).toBeDefined();
          });
        });
      });

      describe("when item exists", () => {
        describe("with string", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await connection.gets(testKey);
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data[testKey].value).toBe(testValue);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const testValue = uuidv4();
            await Promise.all(
              testKeys.map(async (key) => {
                const setResp = await connection.set(key, testValue);
                expect(setResp.code).toBe(ResponseCode.STORED);
              })
            );
            const getsResp = await connection.gets(testKeys);
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data).toBeDefined();
            testKeys.forEach((key) => {
              expect(getsResp.data[key]).toBeDefined();
            });
          });
        });

        describe("with JSON object", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };

            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await connection.gets(testKey, { mode: "json" });
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data[testKey].value).toStrictEqual(testValue);
          });
        });
      });
    });

    describe("set()", () => {
      describe("when there are no existing items", () => {
        describe("with string", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
          });
        });

        describe("with JSON object", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };

            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
          });
        });

        describe("when item exists", () => {
          describe("with string", () => {
            it("should store", async () => {
              const testKey = uuidv4();
              const testValue = uuidv4();
              const setResp = await connection.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const setResp2 = await connection.set(testKey, testValue);
              expect(setResp2.code).toBe(ResponseCode.STORED);

              const getResp = await connection.get(testKey);
              expect(getResp.code).toBe(ResponseCode.END);
              expect(getResp.data[testKey].value).toBe(testValue);
            });
          });

          describe("with JSON object", () => {
            it("should store", async () => {
              const testKey = uuidv4();
              const testValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };

              const setResp = await connection.set(testKey, testValue, {
                mode: "json",
              });
              expect(setResp.code).toBe(ResponseCode.STORED);
              const setResp2 = await connection.set(testKey, testValue, {
                mode: "json",
              });
              expect(setResp2.code).toBe(ResponseCode.STORED);
            });
          });
        });
      });
    });

    describe("add()", () => {
      describe("when there no existing key", () => {
        describe("with string", () => {
          it("should store item", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const addResp = await connection.add(testKey, testValue);
            expect(addResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
          });

          describe("where there is existing key", () => {
            it("should return not store", async () => {
              const testKey = uuidv4();
              const testValue = uuidv4();
              const setResp = await connection.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const addResp = await connection.add(testKey, testValue);
              expect(addResp.code).toBe(ResponseCode.NOT_STORED);
            });
          });
        });

        describe("with JSON object", () => {
          it("should store item", async () => {});
        });
      });

      describe("when there is existing key", () => {
        it("should not store", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const addResp = await connection.add(testKey, testValue);
          expect(addResp.code).toBe(ResponseCode.STORED);
          const addResp2 = await connection.add(testKey, testValue);
          expect(addResp2.code).toBe(ResponseCode.NOT_STORED);
        });
      });
    });

    describe("replace()", () => {
      describe("when there are no existing item", () => {
        describe("with string", () => {
          it("should not store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const replaceResp = await connection.replace(testKey, testValue);
            expect(replaceResp.code).toBe(ResponseCode.NOT_STORED);
          });

          describe("with JSON object", () => {
            it("should not store", async () => {
              const testKey = uuidv4();
              const testValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };
              const replaceResp = await connection.replace(testKey, testValue, {
                mode: "json",
              });
              expect(replaceResp.code).toBe(ResponseCode.NOT_STORED);
            });
          });
        });

        describe("when there are existing item", () => {
          describe("with string", () => {
            it("should replace", async () => {
              const testKey = uuidv4();
              const testValue = uuidv4();
              const setResp = await connection.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const testReplaceValue = uuidv4();
              const appendResp = await connection.replace(
                testKey,
                testReplaceValue
              );
              expect(appendResp.code).toBe(ResponseCode.STORED);
              const getResp = await connection.get(testKey);
              expect(getResp.data[testKey].value).toBe(testReplaceValue);
            });
          });

          describe("with JSON object", () => {
            it("should replace", async () => {
              const testKey = uuidv4();
              const testValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };
              const setResp = await connection.set(testKey, testValue, {
                mode: "json",
              });
              expect(setResp.code).toBe(ResponseCode.STORED);
              const testReplaceValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };
              const replaceResp = await connection.replace(
                testKey,
                testReplaceValue,
                { mode: "json" }
              );
              expect(replaceResp.code).toBe(ResponseCode.STORED);
              const getResp = await connection.get(testKey, {
                mode: "json",
              });
              expect(getResp.code).toBe(ResponseCode.END);
              expect(getResp.data[testKey].value).toStrictEqual(
                testReplaceValue
              );
            });
          });
        });
      });
    });

    describe("append()", () => {
      describe("when there are no existing items", () => {
        describe("with string", () => {
          it("should end with no errors", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const resp = await connection.append(testKey, testValue);
            expect(resp.code).toBe(ResponseCode.NOT_STORED);
          });
        });
      });

      describe("when existing key", () => {
        describe("with string", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const testAppendValue = uuidv4();
            const appendResp = await connection.append(
              testKey,
              testAppendValue
            );
            expect(appendResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.data[testKey].value).toBe(
              testValue + testAppendValue
            );
          });
        });
      });
    });

    describe("prepend()", () => {
      describe("when there are no existing items", () => {
        describe("with string", () => {
          it("should end with no errors", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const resp = await connection.prepend(testKey, testValue);
            expect(resp.code).toBe(ResponseCode.NOT_STORED);
          });
        });
      });

      describe("when existing key", () => {
        describe("with string", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const testAppendValue = uuidv4();
            const appendResp = await connection.prepend(
              testKey,
              testAppendValue
            );
            expect(appendResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.data[testKey].value).toBe(
              testAppendValue + testValue
            );
          });
        });
      });
    });

    describe("cas()", () => {
      describe("when there are no existing items", () => {
        it("should end with not found", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await connection.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const getsResp = await connection.gets(testKey);
          expect(getsResp.code).toBe(ResponseCode.END);
          expect(getsResp.data[testKey]).toBeDefined();
          const casId = getsResp.data[testKey].casId;
          const casResp = await connection.cas(testKey, testKey, casId);
          expect(casResp.code).toBe(ResponseCode.STORED);
        });
      });

      describe("when changed between transaction", () => {
        it("should end with error", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await connection.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const getsResp = await connection.gets(testKey);
          expect(getsResp.code).toBe(ResponseCode.END);
          expect(getsResp.data[testKey]).toBeDefined();
          const casId = getsResp.data[testKey].casId;
          await connection.set(testKey, testValue);
          const casResp = await connection.cas(testKey, testKey, casId);
          expect(casResp.code).toBe(ResponseCode.EXISTS);
        });
      });
    });

    describe("gat()", () => {
      describe("when there are no existing", () => {
        describe("with string", () => {
          it("should not store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await connection.gat(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });

        describe("with json", () => {
          it("should not store", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };
            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, {
              mode: "json",
            });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await connection.gat(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when there are existing item", () => {
        describe("with string", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await connection.gat(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });

        describe("with json", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };
            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, {
              mode: "json",
            });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await connection.gat(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });
    });

    describe("gats()", () => {
      describe("when there are no existing", () => {
        describe("with string", () => {
          it("should not store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await connection.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });

        describe("with json", () => {
          it("should not store", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };
            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await connection.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when there are existing item", () => {
        describe("with string", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await connection.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await connection.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });

        describe("with json", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue: TestValue = {
              value: uuidv4(),
              valueNum: Math.ceil(Math.random() * 10 + 1),
            };
            const setResp = await connection.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await connection.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await connection.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });
    });

    describe("delete()", () => {
      describe("when there are no existing items", () => {
        it("should end with no errors", async () => {
          const testKey = uuidv4();
          const resp = await connection.delete(testKey);
          expect(resp.code).toBe(ResponseCode.NOT_FOUND);
        });
      });
      describe("when existing key", () => {
        it("should return not found", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await connection.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const resp = await connection.delete(testKey);
          expect(resp.code).toBe(ResponseCode.DELETED);
        });
      });
    });

    describe("touch()", () => {
      describe("when there are no existing items", () => {
        it("should end with no errors", async () => {
          connection.on("error", () => {});
          await connection.connect();
          const testKey = uuidv4();
          const resp = await connection.touch(testKey, 100);
          expect(resp.code).toBe(ResponseCode.NOT_FOUND);
        });
      });

      describe("when existing key", () => {
        it("should end with no errors", async () => {
          const testKey = uuidv4();
          const resp = await connection.touch(testKey, 100);
          expect(resp.code).toBe(ResponseCode.NOT_FOUND);
        });
      });
    });

    describe("stats()", () => {
      it("should return all stats", async () => {
        const resp = await connection.stats();
        expect(Object.keys(resp.stats).length).toBe(urls.length);
        Object.keys(resp.stats).forEach((url) => {
          expect(urls.includes(url)).toBe(true);
          Object.keys(resp.stats[url]).forEach((v) => {
            expect(resp.stats[url][v]).toBeDefined();
          });
        });
      });
    });
  });
});

describe("createConnection", () => {
  it("can instance", () => {
    try {
      const _ = createConnection(config);
    } catch (e) {
      expect(e).toBeUndefined;
    }
  });
});
