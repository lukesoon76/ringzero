"""Line-delimited JSON-RPC over stdio (decision D1).

Persistent mode: read one JSON request per line from stdin, write one JSON
response per line to stdout, loop. Single-shot mode (`--once`): handle exactly
one request then exit — used by the synchronous TypeScript bridge.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from .verifier import verify


def handle(request: dict[str, Any]) -> dict[str, Any]:
    method = request.get("method")
    rid = request.get("id")
    if method == "health":
        return {"id": rid, "result": {"ok": True, "service": "ringzero-verify"}}
    if method == "verify":
        params: dict[str, Any] = dict(request.get("params", {}))
        directive: dict[str, Any] = dict(params.get("directive") or params)
        return {"id": rid, "result": verify(directive)}
    return {"id": rid, "error": f"unknown method: {method}"}


def main(argv: list[str]) -> int:
    once = "--once" in argv
    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            request = json.loads(stripped)
            response = handle(request)
        except Exception as exc:  # noqa: BLE001 — fail closed, never crash the bridge
            response = {"error": f"bad request: {exc}"}
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()
        if once:
            break
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
