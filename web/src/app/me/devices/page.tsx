// /me/devices — 본인의 등록된 노트북 (api_tokens) 관리.
// 모든 로그인 사용자 접근 가능. 라벨 변경 + revoke.

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Nav } from "@/components/nav";

interface Device {
  id: number;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function MyDevicesPage() {
  const { status } = useSession();
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
    if (status === "authenticated") void load();
  }, [status, load]);

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-xl font-bold">내 디바이스</h1>
          <p className="text-sm text-neutral-400 mt-1">
            CLI 가 설치된 노트북 목록. 새 노트북은 <code className="text-cyan-400 text-xs">install.sh</code> 또는{" "}
            <code className="text-cyan-400 text-xs">init</code> 명령 한 번이면 자동 추가됩니다. 잃어버린 노트북은 해제하세요.
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
            등록된 디바이스가 없습니다. 노트북에서 <code className="text-cyan-400">install.sh</code> 를 실행하세요.
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
      </main>
    </div>
  );
}
