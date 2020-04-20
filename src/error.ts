export enum ConnectionErrorCode {
  ER_CONN_MAX_CONNECTION = "ER_CONN_MAX_CONNECTION",
  ER_CONN_NO_AVAILABLE = "ER_CONN_NO_AVAILABLE",
  ER_CONN_TIMEOUT = "ER_CONN_TIMEOUT",
  ER_CONN_NOT_OPEN = "ER_CONN_NOT_OPEN",
  ER_CONN_CLOSED = "ER_CONN_CLOSED",
  ER_CONN_SOCKET_NOT_FOUND = "ER_CONN_SOCKET_NOT_FOUND",
}

// extend enum using "extends" keyword
export const ErrorCode = {
  ...ConnectionErrorCode,
};

export class ConnectionError extends Error {
  public code: ConnectionErrorCode;
  constructor(message: string, code: ConnectionErrorCode) {
    super(message);
    this.code = code;
  }
}
