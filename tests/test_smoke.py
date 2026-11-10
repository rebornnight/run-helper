"""最小冒烟测试：验证应用可导入、基础接口可用。

运行：pytest tests/ -q
"""
import os
import tempfile

# 在导入 app 之前指定独立的测试数据库
os.environ.setdefault('DB_PATH', os.path.join(tempfile.gettempdir(), 'lepao_opensource_test.db'))

import storage  # noqa: E402
from app import app, _pick_capture_candidate  # noqa: E402


def setup_module(module):
    if os.path.exists(os.environ['DB_PATH']):
        os.remove(os.environ['DB_PATH'])
    storage.init_db()


def teardown_module(module):
    if os.path.exists(os.environ['DB_PATH']):
        os.remove(os.environ['DB_PATH'])


def test_config():
    resp = app.test_client().get('/api/config')
    body = resp.get_json()
    assert resp.status_code == 200
    assert body['version']
    assert 'disclaimer' in body


def test_routes():
    resp = app.test_client().get('/api/routes')
    body = resp.get_json()
    assert resp.status_code == 200
    assert isinstance(body, list) and body
    assert all({'id', 'label', 'game_id', 'ready'} <= set(item) for item in body)


def test_capture_import_requires_body():
    resp = app.test_client().post('/api/capture/import', json={})
    assert resp.status_code == 400


def test_capture_save_requires_student_num():
    resp = app.test_client().post('/api/capture/save', json={})
    assert resp.status_code == 400


def test_submit_without_config():
    resp = app.test_client().post('/api/submit', json={'route': 'first_field'})
    assert resp.status_code == 400
    assert '未配置' in resp.get_json()['error']


def test_run_session_endpoints_removed():
    # 无倒计时机制：旧的会话接口应已移除（GET 走 catch-all 返回 404，POST 无匹配路由返回 405）
    assert app.test_client().get('/api/user/run/status').status_code == 404
    assert app.test_client().post('/api/user/run/cancel').status_code == 405
    assert app.test_client().post('/api/user/run/start', json={}).status_code == 405


# ── 抓包配置挑选逻辑 ───────────────────────────────────────────────

def _cand(ts, term_id, uid='u1'):
    return {'uid': uid, 'token': 't', 'school_id': '837', 'term_id': str(term_id),
            'student_num': 's1', 'class_id': 0, 'card_id': 'c1', '_timestamp': ts}


def test_pick_candidate_empty():
    assert _pick_capture_candidate([]) is None


def test_pick_candidate_prefers_latest_timestamp():
    picked = _pick_capture_candidate([_cand(100, '10001'), _cand(200, '10001')])
    assert picked['_timestamp'] == 200


def test_pick_candidate_fills_zero_term_id():
    # 最新的报文 term_id=0（getTermList / getOssSts 之类），应从同批抓包补真实学期
    picked = _pick_capture_candidate([
        _cand(100, '10001'),
        _cand(50, '20002'),
        _cand(200, '0'),
    ])
    assert picked['_timestamp'] == 200       # 仍然用最新那条的身份信息
    assert picked['term_id'] == '10001'      # 但 term_id 取时间最接近的非 0 值


def test_pick_candidate_all_zero_keeps_zero():
    picked = _pick_capture_candidate([_cand(100, '0'), _cand(200, '0')])
    assert picked['term_id'] == '0'


def test_pick_candidate_real_term_id_not_overridden():
    picked = _pick_capture_candidate([_cand(100, '10001'), _cand(200, '10001')])
    assert picked['term_id'] == '10001'

