import { Memcached, createPool } from "../../src/memcached";
import { ConnectionConfig } from "../../src/connection";
import { ConnectionError, ConnectionErrorCode } from "../../src/error";
import { v4 as uuidv4 } from "uuid";
import { ResponseCode } from "../../src/response";
import { TestValue } from "../unit/_index";

const config: ConnectionConfig = {
  "localhost:11211": {},
  "localhost:11212": {},
  "localhost:11213": {},
};

jest.setTimeout(10000);

const urls = Object.keys(config);
let memcached: Memcached;

describe("memcached", () => {
  describe("constructor", () => {
    it("can instance by single server", () => {
      const url = urls[0];
      try {
        const _ = new Memcached(url);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it("can instance by array of servers", () => {
      try {
        const _ = new Memcached(urls);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });

    it("can instace by connection congurations", () => {
      try {
        const _ = new Memcached(config);
      } catch (e) {
        expect(e).toBeUndefined();
      }
    });
  });

  describe("clean()", () => {
    it("can't close no connections", () => {
      const memcached = new Memcached(config);
      expect(() => memcached.clean()).toThrowError();
    });
  });

  describe("getConnection()", () => {
    it("can get connection", async () => {
      const memcached = new Memcached(config);
      await memcached.createPool();
      const conn = memcached.getConnection();
      expect(conn).toBeDefined();
    });

    it("fail when no connection in pool", () => {
      const memcached = new Memcached(config);
      try {
        memcached.getConnection();
      } catch (e) {
        const err = e as ConnectionError;
        expect(err.code).toBe(ConnectionErrorCode.ER_CONN_NO_AVAILABLE);
      }
    });
  });

  describe("createConnection()", () => {
    it("can create a connection", async () => {
      const memcached = new Memcached(config);
      const conn = await memcached.createConnection();
      expect(conn).toBeDefined();
    });
  });

  describe("commands", () => {
    beforeEach(async () => {
      memcached = new Memcached(config);
      await memcached.createPool();
    });

    afterEach(() => {
      memcached.clean();
    });

    describe("get()", () => {
      describe("when no item exists", () => {
        describe("with single key", () => {
          it("should return with empty data", async () => {
            const testKey = uuidv4();
            const resp = await memcached.get(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            expect(resp.data[testKey]).toBeUndefined();
          });

          it("should success with many times", async () => {
            const testKey = uuidv4();
            const resp = await memcached.get(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            const resp2 = await memcached.get(testKey);
            expect(resp2.code).toBe(ResponseCode.END);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await memcached.get(testKeys);
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

            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when item exists", () => {
        describe("with string", () => {
          it("should return the item", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            expect(getResp.data[testKey].casId).toBeUndefined();
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await memcached.get(testKeys);
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

            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, { mode: "json" });
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
            const resp = await memcached.gets(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            expect(resp.data[testKey]).toBeUndefined();
          });

          it("should success with many times", async () => {
            const testKey = uuidv4();
            const resp = await memcached.gets(testKey);
            expect(resp.code).toBe(ResponseCode.END);
            const resp2 = await memcached.gets(testKey);
            expect(resp2.code).toBe(ResponseCode.END);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await memcached.gets(testKeys);
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

            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await memcached.gets(testKey, { mode: "json" });
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
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await memcached.gets(testKey);
            expect(getsResp.code).toBe(ResponseCode.END);
            expect(getsResp.data[testKey].value).toBe(testValue);
          });
        });

        describe("with key array", () => {
          it("should return with data", async () => {
            const testKeys = [uuidv4(), uuidv4()];
            const resp = await memcached.gets(testKeys);
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

            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getsResp = await memcached.gets(testKey, { mode: "json" });
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
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
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

            const setResp = await memcached.set(testKey, testValue, {
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
              const setResp = await memcached.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const setResp2 = await memcached.set(testKey, testValue);
              expect(setResp2.code).toBe(ResponseCode.STORED);

              const getResp = await memcached.get(testKey);
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

              const setResp = await memcached.set(testKey, testValue, {
                mode: "json",
              });
              expect(setResp.code).toBe(ResponseCode.STORED);
              const setResp2 = await memcached.set(testKey, testValue, {
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
            const addResp = await memcached.add(testKey, testValue);
            expect(addResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
          });

          describe("where there is existing key", () => {
            it("should return not store", async () => {
              const testKey = uuidv4();
              const testValue = uuidv4();
              const setResp = await memcached.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const addResp = await memcached.add(testKey, testValue);
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
          const addResp = await memcached.add(testKey, testValue);
          expect(addResp.code).toBe(ResponseCode.STORED);
          const addResp2 = await memcached.add(testKey, testValue);
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
            const replaceResp = await memcached.replace(testKey, testValue);
            expect(replaceResp.code).toBe(ResponseCode.NOT_STORED);
          });

          describe("with JSON object", () => {
            it("should not store", async () => {
              const testKey = uuidv4();
              const testValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };
              const replaceResp = await memcached.replace(testKey, testValue, {
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
              const setResp = await memcached.set(testKey, testValue);
              expect(setResp.code).toBe(ResponseCode.STORED);
              const testReplaceValue = uuidv4();
              const appendResp = await memcached.replace(
                testKey,
                testReplaceValue
              );
              expect(appendResp.code).toBe(ResponseCode.STORED);
              const getResp = await memcached.get(testKey);
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
              const setResp = await memcached.set(testKey, testValue, {
                mode: "json",
              });
              expect(setResp.code).toBe(ResponseCode.STORED);
              const testReplaceValue: TestValue = {
                value: uuidv4(),
                valueNum: Math.ceil(Math.random() * 10 + 1),
              };
              const replaceResp = await memcached.replace(
                testKey,
                testReplaceValue,
                { mode: "json" }
              );
              expect(replaceResp.code).toBe(ResponseCode.STORED);
              const getResp = await memcached.get(testKey, {
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
            const resp = await memcached.append(testKey, testValue);
            expect(resp.code).toBe(ResponseCode.NOT_STORED);
          });
        });
      });

      describe("when existing key", () => {
        describe("with string", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const testAppendValue = uuidv4();
            const appendResp = await memcached.append(testKey, testAppendValue);
            expect(appendResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
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
            const resp = await memcached.prepend(testKey, testValue);
            expect(resp.code).toBe(ResponseCode.NOT_STORED);
          });
        });
      });

      describe("when existing key", () => {
        describe("with string", () => {
          it("should store", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const testAppendValue = uuidv4();
            const appendResp = await memcached.prepend(
              testKey,
              testAppendValue
            );
            expect(appendResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
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
          const setResp = await memcached.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const getsResp = await memcached.gets(testKey);
          expect(getsResp.code).toBe(ResponseCode.END);
          expect(getsResp.data[testKey]).toBeDefined();
          const casId = getsResp.data[testKey].casId;
          const casResp = await memcached.cas(testKey, testKey, casId);
          expect(casResp.code).toBe(ResponseCode.STORED);
        });
      });

      describe("when changed between transaction", () => {
        it("should end with error", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await memcached.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const getsResp = await memcached.gets(testKey);
          expect(getsResp.code).toBe(ResponseCode.END);
          expect(getsResp.data[testKey]).toBeDefined();
          const casId = getsResp.data[testKey].casId;
          await memcached.set(testKey, testValue);
          const casResp = await memcached.cas(testKey, testKey, casId);
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
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await memcached.gat(testKey, 100);
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
            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, {
              mode: "json",
            });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await memcached.gat(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when there are existing item", () => {
        describe("with string", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await memcached.gat(testKey, 100);
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
            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, {
              mode: "json",
            });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await memcached.gat(testKey, 100);
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
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toBe(testValue);
            const gatResp = await memcached.gats(testKey, 100);
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
            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await memcached.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });

      describe("when there are existing item", () => {
        describe("with string", () => {
          it("should extend", async () => {
            const testKey = uuidv4();
            const testValue = uuidv4();
            const setResp = await memcached.set(testKey, testValue);
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey);
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await memcached.gats(testKey, 100);
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
            const setResp = await memcached.set(testKey, testValue, {
              mode: "json",
            });
            expect(setResp.code).toBe(ResponseCode.STORED);
            const getResp = await memcached.get(testKey, { mode: "json" });
            expect(getResp.code).toBe(ResponseCode.END);
            expect(getResp.data[testKey].value).toStrictEqual(testValue);
            const gatResp = await memcached.gats(testKey, 100);
            expect(gatResp.code).toBe(ResponseCode.END);
          });
        });
      });
    });

    describe("delete()", () => {
      describe("when there are no existing items", () => {
        it("should end with no errors", async () => {
          const testKey = uuidv4();
          const resp = await memcached.delete(testKey);
          expect(resp.code).toBe(ResponseCode.NOT_FOUND);
        });
      });
      describe("when existing key", () => {
        it("should return not found", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await memcached.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const resp = await memcached.delete(testKey);
          expect(resp.code).toBe(ResponseCode.DELETED);
        });
      });
    });

    describe("touch()", () => {
      describe("when there are no existing items", () => {
        it("should end with no errors", async () => {
          const testKey = uuidv4();
          const resp = await memcached.touch(testKey, 100);
          expect(resp.code).toBe(ResponseCode.NOT_FOUND);
        });
      });

      describe("when existing key", () => {
        it("should extend", async () => {
          const testKey = uuidv4();
          const testValue = uuidv4();
          const setResp = await memcached.set(testKey, testValue);
          expect(setResp.code).toBe(ResponseCode.STORED);
          const resp = await memcached.touch(testKey, 100);
          expect(resp.code).toBe(ResponseCode.TOUCHED);
        });
      });
    });

    describe("stats()", () => {
      it("should return all stats", async () => {
        const resp = await memcached.stats();
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

describe("createPool", () => {
  it("can create memcached instance", () => {
    const memcached = createPool(config);
    expect(memcached).toBeDefined();
  });
});
