/**
 * TS RPC bridge to the Python logical verifiers — a kernel `VerifierPort`.
 *
 * The Python side (`ringzero_verify.rpc`) is a persistent line-delimited
 * JSON-RPC server (decision D1). The kernel's VerifierPort is synchronous, so
 * this adapter invokes the server in single-shot (`--once`) mode via spawnSync:
 * synchronous, timeout-clean, and fail-closed. (A persistent long-lived
 * connection needs the async engine path — a post-seed change; the server
 * already supports it.)
 *
 * Fail closed: a process error, non-zero exit, timeout, or unparseable response
 * all yield Verified=0. A deterministic failure is never overridden by the
 * advisory (LLM) signal the Python verifier may also report.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GovernedState, VerifierPort, VerifyResult } from "@ring-zero/kernel";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_VERIFY_DIR = resolve(here, "..");

export interface PythonVerifierOptions {
  readonly verifyDir?: string;
  readonly timeoutMs?: number;
}

interface RpcResponse {
  readonly result?: {
    readonly verified?: number;
    readonly confidence?: number;
    readonly detail?: string;
    readonly timedOut?: boolean;
  };
  readonly error?: string;
}

export function createPythonVerifier(opts: PythonVerifierOptions = {}): VerifierPort {
  const verifyDir = opts.verifyDir ?? DEFAULT_VERIFY_DIR;
  const timeoutMs = opts.timeoutMs ?? 8000;

  return {
    name: "python-logical-rpc",
    verify(state: GovernedState): VerifyResult {
      const directive = state.data["_verify"] ?? {};
      const request = JSON.stringify({ id: 1, method: "verify", params: { directive } });
      const res = spawnSync(
        "uv",
        ["run", "--directory", verifyDir, "python", "-m", "ringzero_verify.rpc", "--once"],
        {
          input: `${request}\n`,
          encoding: "utf8",
          timeout: timeoutMs,
          // Virtual uv project (package = false): make the source importable for `python -m`.
          env: { ...process.env, PYTHONPATH: resolve(verifyDir, "src") },
        },
      );

      if (res.error) {
        const code = (res.error as NodeJS.ErrnoException).code;
        const timedOut = code === "ETIMEDOUT" || res.signal === "SIGTERM";
        return { verified: 0, confidence: 0, timedOut, detail: `verifier process error: ${res.error.message}` };
      }
      if (res.status !== 0 || !res.stdout) {
        return { verified: 0, confidence: 0, timedOut: false, detail: `verifier exit ${res.status}: ${res.stderr}` };
      }

      try {
        const lines = res.stdout.trim().split("\n");
        const parsed = JSON.parse(lines[lines.length - 1] ?? "") as RpcResponse;
        const r = parsed.result;
        if (!r || (r.verified !== 0 && r.verified !== 1)) {
          return { verified: 0, confidence: 0, timedOut: false, detail: `malformed verifier response: ${parsed.error ?? "?"}` };
        }
        return {
          verified: r.verified,
          confidence: typeof r.confidence === "number" ? r.confidence : 0,
          timedOut: r.timedOut === true,
          detail: r.detail ?? "",
        };
      } catch (err) {
        return { verified: 0, confidence: 0, timedOut: false, detail: `verifier parse error: ${String(err)}` };
      }
    },
  };
}
