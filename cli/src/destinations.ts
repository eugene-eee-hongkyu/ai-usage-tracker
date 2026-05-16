// 다중 destination 설정 로더 — 한 sync 가 N 개 endpoint 에 동시에 데이터 보낼 수 있게.
//
// 우선순위 (앞이 우선):
//   1. ~/.usage-tracker/config.json (또는 USAGE_TRACKER_CONFIG 로 경로 override)
//        {
//          "destinations": [
//            { "name": "local",   "url": "http://localhost:3000" },
//            { "name": "company", "url": "https://aiusage.z21labs.world", "apiKey": "xxx" }
//          ]
//        }
//   2. 기존 환경변수 (backwards compat):
//        USAGE_TRACKER_MODE=local            → name=local, url=http://localhost:$LOCAL_PORT, apiKey=null
//        USAGE_TRACKER_URL + USAGE_TRACKER_API_KEY (또는 keychain) → 단일 destination
//
// apiKey 없거나 null 이면 헤더 미부착 — 서버 측 IS_LOCAL_MODE 가 자동 단일 사용자 보장.

import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadApiKey } from "./init.js";

export interface Destination {
  name: string;
  url: string;
  apiKey?: string | null;
}

interface ConfigFile {
  destinations?: Destination[];
}

function readConfigFile(): ConfigFile | null {
  const path = process.env.USAGE_TRACKER_CONFIG ?? join(homedir(), ".usage-tracker", "config.json");
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as ConfigFile;
    if (parsed.destinations && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed;
    }
  } catch {
    // 파일 없음·파싱 실패는 silent — fallback 으로 env 사용.
  }
  return null;
}

export async function loadDestinations(): Promise<Destination[]> {
  const cfg = readConfigFile();
  if (cfg?.destinations?.length) {
    return cfg.destinations.map((d) => ({
      name: d.name,
      url: d.url.replace(/\/$/, ""),  // trailing slash 정리
      apiKey: d.apiKey ?? null,
    }));
  }

  // backwards-compat 단일 destination
  const localMode = process.env.USAGE_TRACKER_MODE === "local";
  const localPort = process.env.LOCAL_PORT ?? "3000";
  const url =
    process.env.USAGE_TRACKER_URL ??
    (localMode ? `http://localhost:${localPort}` : "https://aiusage.z21labs.world");
  const apiKey = localMode ? null : (process.env.USAGE_TRACKER_API_KEY ?? (await loadApiKey()));
  return [
    {
      name: localMode ? "local" : "default",
      url: url.replace(/\/$/, ""),
      apiKey,
    },
  ];
}
