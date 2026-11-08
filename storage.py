"""本地存储（SQLite）：乐跑配置、提交记录。

所有数据只存本地：
- config       : 仅一行，保存乐跑抓包配置（token 加密落库）
- run_logs     : 提交历史
"""
import json
import os
import sqlite3
import threading
import time
from contextlib import contextmanager

from config import DB_PATH
from crypto_util import aes_decrypt, aes_encrypt

_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS config (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    payload    TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS run_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id       TEXT,
    status          INTEGER,
    distance        REAL,
    reason          TEXT,
    config_snapshot TEXT,
    created_at      INTEGER NOT NULL
);
"""


@contextmanager
def _db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    parent = os.path.dirname(os.path.abspath(DB_PATH))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with _lock, _db() as conn:
        conn.executescript(_SCHEMA)


# ── 乐跑配置 ──────────────────────────────────────────────────────────────

def get_config():
    """读取乐跑配置（token 解密后返回）；未配置返回 None。"""
    with _lock, _db() as conn:
        row = conn.execute('SELECT payload FROM config WHERE id = 1').fetchone()
    if not row:
        return None
    try:
        cfg = json.loads(row['payload'])
    except Exception:
        return None
    if cfg.get('token'):
        try:
            cfg['token'] = aes_decrypt(cfg['token'])
        except Exception:
            pass
    return cfg


def save_config(cfg):
    """保存乐跑配置（token 加密后落库），覆盖旧配置。"""
    data = dict(cfg)
    if data.get('token'):
        data['token'] = aes_encrypt(data['token'])
    payload = json.dumps(data, ensure_ascii=False)
    now = int(time.time())
    with _lock, _db() as conn:
        conn.execute(
            'INSERT INTO config (id, payload, updated_at) VALUES (1, ?, ?) '
            'ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
            (payload, now),
        )


def delete_config():
    with _lock, _db() as conn:
        conn.execute('DELETE FROM config WHERE id = 1')


# ── 提交记录 ──────────────────────────────────────────────────────────────

def log_run(record_id, status, distance, reason, config_snapshot):
    with _lock, _db() as conn:
        conn.execute(
            'INSERT INTO run_logs (record_id, status, distance, reason, config_snapshot, created_at) '
            'VALUES (?, ?, ?, ?, ?, ?)',
            (str(record_id or ''), int(status or 0), float(distance or 0),
             reason or '', json.dumps(config_snapshot or {}, ensure_ascii=False),
             int(time.time())),
        )


def get_runs(limit=50):
    with _lock, _db() as conn:
        rows = conn.execute(
            'SELECT * FROM run_logs ORDER BY id DESC LIMIT ?', (int(limit),)
        ).fetchall()
    return [dict(r) for r in rows]
