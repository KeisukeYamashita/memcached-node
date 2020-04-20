import * as Hashring from "hashring";
export interface ServerOptions {
  basicAuth: BasicAuth;
}

export interface BasicAuth {
  username: string;
  password: string;
}

const defaultServerOptions: Partial<ServerOptions> = {};

function parseUrl(url: string): Record<string, string | number> {
  const [host, portStr] = url.split(":");
  const port = parseInt(portStr, 10);
  return { host, port };
}

export class Server {
  public url: string;
  public host: string;
  public port: number;
  private _options: ServerOptions;

  constructor(url: string, options?: Partial<ServerOptions>) {
    this.url = url;
    const { host, port } = parseUrl(url);
    this.host = host as string;
    this.port = port as number;
    this._options = { ...defaultServerOptions, ...options } as ServerOptions;
  }
}

export type ServerConfigs = Record<string, number | ServerConfig>;
export type ServerConfig = Partial<Hashring.ServerConfig & ServerOptions>;
