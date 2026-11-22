"""One public Zhihu search only; full local production routes/UI; never exports a service secret.
Build first. Use --cli ABSOLUTE_PATH_TO_AUTHENTICATED_OFFICIAL_CLI, or --capture FILE for a replay.
A replay is deliberately labelled as such. No private browsing history or account APIs are used.
"""

import argparse
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright
from verify_bookmarks import public_answers

ROOT = Path(__file__).resolve().parent.parent


def main():
    p = argparse.ArgumentParser()
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("--cli", type=Path)
    source.add_argument("--capture", type=Path)
    p.add_argument("--query", default="读书笔记 方法")
    p.add_argument("--channel", default="msedge")
    a = p.parse_args()
    path = a.cli or a.capture
    if not (path.is_absolute() and path.is_file()):
        p.error("Pass the absolute path of an existing CLI or capture")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = {
        **os.environ,
        "NEXT_TELEMETRY_DISABLED": "1",
        "ZHIHU_ACCESS_SECRET": "acceptance-transport-only",
        "LLM_BASE_URL": "",
        "LLM_API_KEY": "",
        "LLM_MODEL": "",
        "BOOKMARK_PUBLIC_QUERY": a.query,
        "BOOKMARK_PUBLIC_CLI": str(a.cli or ""),
        "BOOKMARK_PUBLIC_CAPTURE": str(a.capture or ""),
    }
    # Don't pass the server's deliberately inert test token to the official CLI subprocess.
    proc = subprocess.Popen(
        [
            "node",
            "--require",
            str(ROOT / "scripts/bookmark-test-transport.cjs"),
            str(ROOT / "node_modules/next/dist/bin/next"),
            "start",
            "--hostname",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=ROOT,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError("Production preview exited")
            try:
                with opener.open(base, timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.15)
        else:
            raise RuntimeError("Production preview did not start")
        print(
            "Source:",
            (
                "official CLI, live public search"
                if a.cli
                else "replay of a public search capture"
            ),
            flush=True,
        )
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel=a.channel, headless=True)
            try:
                public_answers(browser, base, a.query)
            finally:
                browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


if __name__ == "__main__":
    main()
