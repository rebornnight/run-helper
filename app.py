"""跑步助手 API。

⚠️ 本项目仅供学习与研究，请勿用于违反校规或作弊。使用风险自负。

本地运行流程：
  1. 抓包获取乐跑请求的 data 参数
       POST /api/capture/import      {"raw_body": "curl ..."}
       POST /api/capture/save        {"...extracted", "student_num": "学号"}
  2. 查看可用场地
       GET  /api/routes
  3. 直接提交（无倒计时）
       POST /api/submit              {"route": "first_field"}
  4. 复用历史记录
       POST /api/capture/records     {"term_id": "12734"}
       POST /api/submit/with-record  {"record_id": "...", "route": "first_field"}
"""
import json
import os
import re
import threading
import time
from collections import defaultdict
from functools import wraps

from flask import Flask, jsonify, request, send_file, send_from_directory
from werkzeug.security import safe_join

import storage
from config import BASE_DIR, FRONTEND_DIST, HOST, MAX_CONTENT_LENGTH, PORT
from runner import (
    ROUTES,
    generate_device_fingerprint,
    get_term_list,
    get_user_records,
    pick_record_for_route,
    submit_run,
    submit_using_record,
    validate_token,
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

_SUBMIT_LOCK = threading.Lock()


# ── 请求速率限制（内存滑动窗口，防误触/重放） ─────────────────────────────

class RateLimiter:
    def __init__(self):
        self._store = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, key, max_requests, window_seconds):
        now = time.time()
        with self._lock:
            bucket = self._store[key]
            bucket[:] = [t for t in bucket if t > now - window_seconds]
            if len(bucket) >= max_requests:
                return False, int(bucket[0] + window_seconds - now) + 1
            bucket.append(now)
            return True, 0


_limiter = RateLimiter()


def rate_limit(max_requests, window_seconds):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if app.config.get('TESTING'):
                return f(*args, **kwargs)
            ok, retry = _limiter.is_allowed(request.endpoint or f.__name__,
                                            max_requests, window_seconds)
            if not ok:
                resp = jsonify({'error': '请求过于频繁，请稍后重试', 'retry_after': retry})
                resp.headers['Retry-After'] = str(retry)
                resp.status_code = 429
                return resp
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ── 辅助 ──────────────────────────────────────────────────────────────────

def _config():
    """读取本地保存的乐跑配置（token 已解密）。"""
    return storage.get_config()


def _config_error():
    """未配置时返回 (None, (resp, 400))，否则 (cfg, None)。"""
    cfg = _config()
    if not cfg:
        return None, (jsonify({'error': '未配置模拟环境，请先导入抓包数据'}), 400)
    return cfg, None


def _mask_token(cfg):
    display = dict(cfg)
    token = display.get('token') or ''
    if len(token) > 8:
        display['token'] = token[:4] + '****' + token[-4:]
    return display


# ── 抓包解析 ──────────────────────────────────────────────────────────────

_REQUIRED_FIELDS = ('uid', 'token', 'student_num')


def _extract_all_data_from_curl(text):
    """从 curl 命令中提取所有 data 参数值（已 URL 解码）。"""
    results = []
    for q in ("'", '"'):
        pat = re.compile(r"--(?:data-urlencode|data|data-raw|data-binary)\s+" + q
                         + r"data=([^" + q + r"]+)" + q)
        results.extend(pat.findall(text))

    if not results:
        for q in ("'", '"'):
            pat = re.compile(r"-d\s+" + q + r"data=([^" + q + r"]+)" + q)
            results.extend(pat.findall(text))

    if not results:
        from urllib.parse import parse_qs
        for pattern in (r"-(?:d|data|data-raw|data-binary)\s+'([^']+)'",
                        r"-(?:d|data|data-raw|data-binary)\s+\"([^\"]+)\""):
            for body in re.findall(pattern, text):
                params = parse_qs(body)
                if 'data' in params:
                    results.append(params['data'][0])

    if not results:
        results.extend(re.findall(
            r"--(?:data-urlencode|data|data-raw|data-binary)\s+data=(\S+)", text))

    if not results:
        return []
    from urllib.parse import unquote
    return [unquote(m) for m in results]


def _try_extract(data_param):
    """解密 data 参数并提取配置字段；失败返回 None。"""
    from crypto_util import try_decrypt
    decrypted = try_decrypt(data_param)
    if not decrypted:
        return None
    extracted = {
        'uid': str(decrypted.get('uid', '')),
        'token': str(decrypted.get('token', '')),
        'school_id': str(decrypted.get('school_id', '837')),
        'term_id': str(decrypted.get('term_id') or '0'),
        'student_num': str(decrypted.get('student_num', '')),
        'class_id': int(decrypted.get('class_id', 0)),
        'card_id': str(decrypted.get('card_id', '')),
        '_timestamp': int(decrypted.get('timestamp', 0)),
    }
    if any(not extracted.get(k) for k in _REQUIRED_FIELDS):
        return None
    # student_num=0 说明该接口不包含用户配置信息，跳过
    if extracted.get('student_num') == '0':
        return None
    return extracted


# ═════════════════ 基础接口 ═════════════════

@app.route('/api/config', methods=['GET'])
def handle_config():
    """返回运行状态与声明。"""
    return jsonify({
        'version': '1.0.0',
        'disclaimer': '仅供学习研究，请勿用于违反校规或作弊。',
        'configured': _config() is not None,
        'route_count': len(ROUTES),
    })


@app.route('/api/routes', methods=['GET'])
def handle_routes():
    """返回可用场地列表。"""
    return jsonify([{
        'id': k,
        'label': v['label'],
        'game_id': v['game_id'],
        'ready': v.get('ready', False),
    } for k, v in ROUTES.items()])


@app.route('/api/runs', methods=['GET'])
def handle_runs():
    """最近的提交记录。"""
    limit = request.args.get('limit', 50, type=int)
    return jsonify({'runs': storage.get_runs(min(max(limit, 1), 200))})


# ═════════════════ 抓包配置 ═════════════════

@app.route('/api/capture/config', methods=['GET'])
def handle_capture_get_config():
    cfg = _config()
    if not cfg:
        return jsonify({'status': 'ok', 'config': None, 'has_config': False})
    return jsonify({'status': 'ok', 'config': _mask_token(cfg), 'has_config': True})


@app.route('/api/capture/config', methods=['DELETE'])
def handle_capture_delete_config():
    storage.delete_config()
    return jsonify({'status': 'ok', 'message': '已清除'})


@app.route('/api/capture/import', methods=['POST'])
def handle_capture_import():
    """解析抓包数据，返回提取结果（不保存）。"""
    body = request.get_json(silent=True) or {}
    raw = (body.get('raw_body') or '').strip()
    if not raw:
        return jsonify({'error': '缺少 raw_body'}), 400
    if len(raw) > 500_000:
        return jsonify({'error': 'raw_body 过大，请检查是否粘贴了正确的抓包命令'}), 400

    extracted = None
    candidates = []
    for dp in _extract_all_data_from_curl(raw):
        cand = _try_extract(dp)
        if cand:
            candidates.append(cand)
    if candidates:
        # 取 timestamp 最新的，避免旧 token 覆盖新 token
        candidates.sort(key=lambda c: int(c.get('_timestamp', 0)), reverse=True)
        extracted = candidates[0]
        # 有些接口（getTermList / getSchoolInfo / WpIndex/index 等）报文里 term_id 固定为 0，
        # 若挑中的恰好是这类报文，就从同一批抓包里补一个真实 term_id
        if str(extracted.get('term_id') or '0') in ('0', ''):
            base_ts = int(extracted.get('_timestamp', 0))
            real_tids = [(int(c.get('_timestamp', 0)), str(c.get('term_id')))
                         for c in candidates
                         if str(c.get('term_id') or '0') not in ('0', '')]
            if real_tids:
                # 优先取时间最接近的（同一次抓包会话）
                real_tids.sort(key=lambda x: abs(x[0] - base_ts))
                extracted['term_id'] = real_tids[0][1]

    if not extracted:
        from urllib.parse import parse_qs
        params = parse_qs(raw)
        data_param = (params.get('data') or [None])[0]
        if data_param:
            extracted = _try_extract(data_param)

    if not extracted:
        return jsonify({'error': '未找到有效的 data 参数，请粘贴包含 uid/token/学号的 curl 命令'}), 400

    return jsonify({'status': 'ok', 'extracted': extracted})


@app.route('/api/capture/save', methods=['POST'])
def handle_capture_save():
    """保存乐跑配置（覆盖旧配置）。"""
    data = request.get_json(silent=True) or {}
    student_num = str(data.get('student_num', '')).strip()
    if not student_num:
        return jsonify({'error': '缺少学号 student_num'}), 400

    existing = _config() or {}
    cfg = {
        'uid': str(data.get('uid', '')),
        'token': str(data.get('token', '')),
        'school_id': str(data.get('school_id', '837')),
        'term_id': str(data.get('term_id', '0')),
        'student_num': student_num,
        'class_id': int(data.get('class_id', 0)),
        'card_id': str(data.get('card_id', '')),
        'device': existing.get('device') or generate_device_fingerprint(),
    }
    if not cfg['uid'] or not cfg['token']:
        return jsonify({'error': '缺少 uid 或 token'}), 400

    storage.save_config(cfg)
    return jsonify({'status': 'ok', 'message': '配置已保存', 'config': _mask_token(cfg)})


@app.route('/api/capture/terms', methods=['POST'])
def handle_capture_terms():
    """获取可选学期列表。"""
    cfg, err = _config_error()
    if err:
        return err
    if not validate_token(cfg):
        return jsonify({'terms': [], 'error': '登录信息已失效，请重新模拟'})
    try:
        return jsonify({'terms': get_term_list(cfg)})
    except Exception as e:
        return jsonify({'terms': [], 'error': str(e)})


@app.route('/api/capture/records', methods=['POST'])
def handle_capture_records():
    """获取该账号的历史跑步记录（可按 term_id 指定学期）。"""
    cfg, err = _config_error()
    if err:
        return err
    if not validate_token(cfg):
        return jsonify({'records': [], 'error': '登录信息已失效，请重新模拟'})
    data = request.get_json(silent=True) or {}
    term_id = data.get('term_id')
    try:
        records = get_user_records(
            cfg, days=60, max_pages=10,
            term_id=(str(term_id) if term_id not in (None, '') else None),
        )
        return jsonify({'records': records})
    except Exception as e:
        return jsonify({'records': [], 'error': str(e)})


# ═════════════════ 提交 ═════════════════

def _log_submit(cfg, result):
    storage.log_run(
        result.get('record_id', ''),
        result.get('status', 0),
        result.get('distance', 0),
        result.get('reason', ''),
        {k: v for k, v in cfg.items() if k != 'token'},  # 不落库明文 token
    )
    if result.get('status') != 1 and result.get('reason'):
        result['error'] = result['reason']
    return result


@app.route('/api/submit', methods=['POST'])
@rate_limit(5, 60)
def handle_submit():
    """提交一次跑步（使用当前路线模板 + 预选记录）。"""
    cfg, err = _config_error()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    route_name = data.get('route', 'first_field')
    route = ROUTES.get(route_name)
    if not route:
        return jsonify({'error': f'无效路线: {route_name}'}), 400
    if not route.get('ready', False):
        return jsonify({'error': '该路线暂无可用轨迹数据'}), 400
    if not validate_token(cfg):
        return jsonify({'error': '登录信息已失效，请重新模拟'}), 401

    with _SUBMIT_LOCK:
        # 直接提交：按场地选一条参考记录（距离 / 配速 / 步数），无倒计时
        pre_record = pick_record_for_route(route['game_id'])
        result = submit_run(cfg, route_name=route_name, pre_record=pre_record)
        _log_submit(cfg, result)
        return jsonify(result)


@app.route('/api/submit/with-record', methods=['POST'])
@rate_limit(5, 60)
def handle_submit_with_record():
    """使用某条历史记录的 GPS 轨迹提交跑步。"""
    cfg, err = _config_error()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    record_id = str(data.get('record_id', '')).strip()
    route_name = data.get('route', 'first_field')
    if not record_id:
        return jsonify({'error': '缺少 record_id'}), 400
    route = ROUTES.get(route_name)
    if not route or not route.get('ready', False):
        return jsonify({'error': f'无效或未启用的路线: {route_name}'}), 400
    if not validate_token(cfg):
        return jsonify({'error': '登录信息已失效，请重新模拟'}), 401

    with _SUBMIT_LOCK:
        result = submit_using_record(cfg, record_id, route_name)
        _log_submit(cfg, result)
        return jsonify(result)


# ═════════════════ 静态资源 ═════════════════
# 若设置了 FRONTEND_DIST（任意 SPA 的 dist 目录）则直接托管；
# 否则返回内置说明页 static/index.html。

_STATIC_DIR = os.path.join(BASE_DIR, 'static')


@app.route('/assets/<path:filename>')
def _serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), filename)


def _send_asset(fp):
    """发送静态文件，并禁止浏览器强缓存（改图后普通刷新即可生效）。"""
    resp = send_file(fp, conditional=True)
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@app.route('/')
@app.route('/<path:path>')
def _serve_frontend(path=''):
    if path.startswith('api/'):
        return jsonify({'error': 'not found'}), 404

    # 1) 真实静态文件：优先前端 dist，其次内置说明页
    for base in (FRONTEND_DIST, _STATIC_DIR):
        if base and os.path.isdir(base):
            fp = safe_join(base, path or 'index.html')
            if fp and os.path.isfile(fp):
                return _send_asset(fp)

    # 2) SPA fallback：无扩展名的路径交给前端路由
    if '.' not in path.split('/')[-1] and os.path.isdir(FRONTEND_DIST):
        return _send_asset(os.path.join(FRONTEND_DIST, 'index.html'))

    return jsonify({'error': 'not found'}), 404


# ═════════════════ 启动 ═════════════════

def _bootstrap():
    """初始化本地数据库。"""
    storage.init_db()


if __name__ == '__main__':
    _bootstrap()
    print(f'跑步助手 API 已启动: http://{HOST}:{PORT}')
    print('⚠️  仅供学习研究，请勿用于违反校规或作弊。')
    app.run(host=HOST, port=PORT, debug=False)
