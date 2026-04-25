import { spawn } from "child_process";

export interface RawSession {
  sessionId: string;
  project: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  startedAt: string;
  endedAt: string;
  // edit tracking fields (may not be present in all ccusage versions)
  oneShotEdits?: number;
  totalEdits?: number;
}

export async function fetchSessionsSince(since: string): Promise<RawSession[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["ccusage", "--json", "--since", since], {
      env: { ...process.env, PATH: process.env.PATH },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ccusage exited ${code}: ${stderr}`));
        return;
      }
      try {
        const raw = JSON.parse(stdout);
        const sessions: RawSession[] = Array.isArray(raw)
          ? raw
          : raw.sessions ?? [];
        resolve(sessions);
      } catch {
        reject(new Error(`ccusage JSON parse failed: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

export function computeOneShotRate(
  oneShotEdits: number,
  totalEdits: number
): number {
  if (totalEdits === 0) return 0;
  return Math.round((oneShotEdits / totalEdits) * 100);
}
