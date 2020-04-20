export interface Response {
  code: ResponseCode;
  data?: { [key: string]: Metadata };
  stats?: Stats;
}

export interface StatsResponse {
  code: ResponseCode;
  stats: { [key: string]: Stats };
}

export interface Stats {
  pid: number;
  uptime: number;
  time: number;
  version: string;
  libevent: string;
  pointer_size: number;
  rusage_user: number;
  rusage_system: number;
  max_connections: number;
  curr_connections: number;
  total_connections: number;
  rejected_connections: number;
  connection_structures: number;
  response_obj_bytes: number;
  response_obj_total: number;
  response_obj_free: number;
  response_obj_oom: number;
  read_buf_bytes: number;
  read_buf_bytes_free: number;
  read_buf_oom: number;
  reserved_fds: number;
  cmd_get: number;
  cmd_set: number;
  cmd_flush: number;
  cmd_touch: number;
  cmd_meta: number;
  get_hits: number;
  get_misses: number;
  get_expired: number;
  get_flushed: number;
  deleted_misses: number;
  delete_hits: number;
  incr_misses: number;
  incre_hits: number;
  descr_misses: number;
  decr_hits: number;
  cas_misses: number;
  cas_hits: number;
  cas_badval: number;
  touch_hits: number;
  touch_misses: number;
  auth_cmds: number;
  auth_errors: number;
  bytes_read: number;
  bytes_written: number;
  limit_maxbytes: number;
  accepting_conns: number;
  listen_disabled_num: number;
  time_in_listen_disabled_us: number;
  threads: number;
  conn_yields: number;
  hash_power_level: number;
  hash_bytes: number;
  hash_is_expanding: number;
  slab_reassign_rescues: number;
  slab_reassign_chunk_rescues: number;
  slab_reassign_evictions_nomem: number;
  slab_reassign_inline_reclaim: number;
  slab_reassign_busy_items: number;
  slab_reassign_busy_deletes: number;
  slab_reassign_running: number;
  slabs_moved: number;
  lru_crawler_running: number;
  lru_crawler_starts: number;
  lru_maintainer_juggles: number;
  malloc_fails: number;
  log_worker_dropped: number;
  log_worker_written: number;
  log_watcher_skipped: number;
  log_watcher_sent: number;
  bytes: number;
  curr_items: number;
  total_items: number;
  slab_global_page_pool: number;
  expired_unfetched: number;
  evicted_unfetched: number;
  evicted_active: number;
  evictions: number;
  reclaimed: number;
  crawler_reclaimed: number;
  crawler_items_checked: number;
  lrutail_reflocked: number;
  moves_to_cold: number;
  moves_to_warm: number;
  moves_within_lru: number;
  direct_reclaims: number;
  lru_bumps_dropped: number;
}

export interface Metadata {
  key: string;
  flags?: number;
  bytes?: number;
  value?: string | Record<string, any>;
  casId?: number;
}

const RETURN = "\r\n";

export enum ResponseCode {
  END = "END",
  STORED = "STORED",
  NOT_STORED = "NOT_STORED",
  NOT_FOUND = "NOT_FOUND",
  EXISTS = "EXISTS",
  DELETED = "DELETED",
  TOUCHED = "TOUCHED",
  ERROR = "ERROR",
  CLIENT_ERROR = "CLIENT_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
}

const codes: Array<string> = [
  ResponseCode.END,
  ResponseCode.STORED,
  ResponseCode.NOT_STORED,
  ResponseCode.NOT_FOUND,
  ResponseCode.EXISTS,
  ResponseCode.DELETED,
  ResponseCode.TOUCHED,
  ResponseCode.ERROR,
  ResponseCode.CLIENT_ERROR,
  ResponseCode.SERVER_ERROR,
];

export function parseResponseCode(chunk: Buffer): ResponseCode {
  const str = chunk.toString();
  const match = str.match(/^[A-Z_]+\r\n$/);
  if (match) {
    return match[0].replace(/\r\n$/, "") as ResponseCode;
  }
  const tail = str.match(/\r\n[A-Z_]+\r\n$/);
  if (tail) {
    return tail[0].replace(/\r\n/g, "") as ResponseCode;
  }

  throw new Error("no matching error");
}

export function parseResponse(chunk: Buffer): { [key: string]: Metadata } {
  let base = 0;
  const metadata: { [key: string]: Metadata } = {};

  do {
    let start = chunk.indexOf(RETURN, base);
    const meta = chunk.slice(base, start).toString("utf8").split(" ");
    start += RETURN.length;
    if (codes.includes(meta[0])) {
      break;
    }

    const value = chunk.slice(start, start + parseInt(meta[3], 10));
    metadata[meta[1]] = {
      key: meta[1],
      flags: parseInt(meta[2], 10),
      bytes: parseInt(meta[3], 10),
      value: value.toString("utf8"),
    };
    if (meta.length > 3 && meta[4]) {
      metadata[meta[1]].casId = parseInt(meta[4], 10);
    }

    base = start + parseInt(meta[3]) + RETURN.length;
  } while (true);

  return metadata;
}

export function parseStatResponse(chunk: Buffer): Stats {
  let base = 0;
  const stats = {};
  do {
    let start = chunk.indexOf(RETURN, base);
    const meta = chunk.slice(base, start).toString("utf8").split(" ");
    start += RETURN.length;
    if (meta[0] === ResponseCode.END) {
      break;
    }

    const key = meta[1];
    let value: string | number = Number(meta[2]);
    if (value === NaN) {
      value = meta[2];
    }

    stats[key] = value;
    base = start;
  } while (true);

  return stats as Stats;
}

export default {
  parseResponseCode,
  parseStatResponse,
};
