#!/usr/bin/env bash
# 跑步助手 启动器（macOS / Linux）
set -u
cd "$(dirname "$0")"

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

PY=""
for c in python3 python; do
    if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
    echo "[ERROR] Python not found."
    echo "Please install Python 3.8 or newer from https://www.python.org/downloads/"
    exit 1
fi

exec "$PY" launcher.py
