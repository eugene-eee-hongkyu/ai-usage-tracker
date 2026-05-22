"use client";

// 본인의 등록된 노트북 (api_tokens) 관리.
// /setup-status 페이지에 임베드되어 사용. 라벨 변경 + revoke.

import { useEffect, useState, useCallback } from "react";

interface DeviceMetadata {
  platform?: string;
  osRelease?: string;
  osArch?: string;
  nodeVersion?: string;
  cliVersion?: string;
  claudeCodeVersion?: string | null;
  codeburnVersion?: string | null;
  ccusageVersion?: string | null;
  installMethod?: string;
  lastError?: { kind?: string; status?: number; statusText?: string; message?: string; at?: string } | null;
}

interface Device {
  id: number;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  metadata?: DeviceMetadata | null;
}

function platformLabel(p?: string): string {
  if (p === "darwin") return "macOS";
  if (p === "win32") return "Windows";
  if (p === "linux") return "Linux";
  return p ?? "—";
}

export function DevicesSection() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/me/devices");
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const d = (await r.json()) as { devices: Device[] };
      setDevices(d.devices);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function rename(id: number) {
    const trimmed = editName.trim();
    if (trimmed.length < 1 || trimmed.length > 64) {
      setError("이름은 1~64자.");
      return;
    }
    setBusyId(id);
    try {
      const r = await fetch(`/api/me/devices?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      setEditingId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: number, name: string) {
    if (!confirm(`'${name}' 디바이스를 해제하시겠습니까?\n이 디바이스에서 더 이상 데이터가 올라오지 않습니다.`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/me/devices?id=${id}`, { method: "DELETE" });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-sm font-bold text-slate-200">내 디바이스</h2>
        <p className="text-xs text-slate-500 mt-1">
          CLI 가 설치된 노트북 목록. 새 노트북은 위 install 명령 한 번이면 자동 추가됩니다. 잃어버린 노트북은 해제하세요.
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-400 font-mono bg-red-950/30 border border-red-900/50 rounded p-2">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-neutral-500">불러오는 중...</p>}

      {!loading && devices.length === 0 && (
        <p className="text-sm text-neutral-500">
          등록된 디바이스가 없습니다. 위 install 명령을 실행하세요.
        </p>
      )}

      {!loading && devices.length > 0 && (
        <ul className="space-y-2">
          {devices.map((d) => (
            <li
              key={d.id}
              className="bg-neutral-900 border border-neutral-800 rounded p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                {editingId === d.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      maxLength={64}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(d.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => rename(d.id)}
                      disabled={busyId === d.id}
                      className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-neutral-100 truncate">{d.name}</p>
                    <p className="text-xs text-neutral-500">
                      등록: {new Date(d.createdAt).toLocaleString("ko")}
                      {d.lastUsedAt && (
                        <>
                          {" · "}
                          마지막 sync: {new Date(d.lastUsedAt).toLocaleString("ko")}
                        </>
                      )}
                      {!d.lastUsedAt && <> · sync 기록 없음</>}
                    </p>
                    {d.metadata && Object.keys(d.metadata).length > 0 && (
                      <div className="text-[11px] text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {d.metadata.platform && (
                          <span>
                            {platformLabel(d.metadata.platform)}
                            {d.metadata.osArch ? ` ${d.metadata.osArch}` : ""}
                            {d.metadata.osRelease ? ` ${d.metadata.osRelease}` : ""}
                          </span>
                        )}
                        {d.metadata.nodeVersion && <span>Node {d.metadata.nodeVersion}</span>}
                        {d.metadata.cliVersion && <span>CLI v{d.metadata.cliVersion}</span>}
                        {d.metadata.claudeCodeVersion && (
                          <span>Claude {d.metadata.claudeCodeVersion}</span>
                        )}
                        {d.metadata.ccusageVersion && (
                          <span>ccusage {d.metadata.ccusageVersion}</span>
                        )}
                        {/* 옛 "⚠ SessionEnd hook 미등록" 경고 제거 (2026-05-22).
                            install/repair 흐름에 hook 등록 함수 자체가 없고
                            (cron 기반 수집) 신규 사용자는 항상 false 라
                            misleading. 데이터 수집은 launchd/Task Scheduler 가
                            담당. */}
                        {d.metadata.installMethod && d.metadata.installMethod !== "unknown" && (
                          <span>installed via {d.metadata.installMethod}</span>
                        )}
                        {d.metadata.lastError && (
                          <span className="text-red-400">
                            ⚠ 직전 sync 실패:{" "}
                            {d.metadata.lastError.kind === "http"
                              ? `HTTP ${d.metadata.lastError.status}`
                              : d.metadata.lastError.message?.slice(0, 60) ?? "network"}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {editingId !== d.id && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(d.id);
                      setEditName(d.name);
                      setError(null);
                    }}
                    className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200"
                  >
                    이름 변경
                  </button>
                  <button
                    onClick={() => revoke(d.id, d.name)}
                    disabled={busyId === d.id}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    해제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
