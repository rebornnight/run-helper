"""乐跑 API 通信模块 — OSS 上传、提交跑步、历史记录。

API 调用委托给 run_replica（其 TLS 指纹会话可通过乐跑 WAF 校验）。
场地轨迹模板为同目录下的 _*_route.json。
"""
import json, time, random, os, base64, hashlib, hmac, uuid
import requests

DIR = os.path.dirname(os.path.abspath(__file__))

import run_replica

# ── 设备指纹：每用户生成一次，持久存储 ───────────────────────────────────────
DEVICE_POOL = [
    ('Xiaomi 15', '15'), ('Xiaomi 15 Pro', '15'),
    ('Xiaomi 14 Ultra', '14'), ('Samsung Galaxy S25 Ultra', '15'),
    ('OPPO Find X8', '15'), ('OPPO Find X8 Pro', '15'),
    ('vivo X200', '15'), ('vivo X200 Pro', '15'),
    ('Samsung Galaxy S25', '15'), ('Samsung Galaxy S24', '14'),
    ('Honor Magic 7', '15'), ('Honor Magic 7 Pro', '15'),
    ('OnePlus 13', '15'), ('OnePlus 12', '14'),
    ('Redmi K80', '15'), ('Redmi K70', '14'),
    ('Redmi Note 14 Pro', '14'), ('Redmi Note 13', '14'),
    ('Redmi Turbo 4', '15'), ('OPPO K12', '14'),
    ('OPPO Reno 13', '15'), ('OPPO A3 Pro', '14'),
    ('vivo S20', '15'), ('vivo Y200', '14'),
    ('Honor 200', '14'), ('Honor X60', '14'),
    ('Realme GT Neo7', '15'), ('iQOO Neo10', '15'),
    ('iQOO Z9', '14'), ('iQOO 13', '15'),
]


def generate_device_fingerprint():
    """生成一组合理的安卓设备指纹（首次调用后应持久存储）。"""
    model, os_ver = random.choice(DEVICE_POOL)
    return {
        'mobileDeviceId': str(uuid.uuid4()),
        'mobileModel': model,
        'mobileOsVersion': os_ver,
    }


def get_device_info(config):
    """从 config 中读取设备指纹，若无则返回默认值 1（兼容旧用户）。"""
    dev = config.get('device')
    if dev and dev.get('mobileDeviceId'):
        return dev['mobileDeviceId'], dev['mobileModel'], dev['mobileOsVersion']
    return 1, 1, 1


def api_call(endpoint, config, extra_params=None):
    return run_replica.api_call(endpoint, config, extra_params)


def validate_token(config):
    """检查 token 是否有效（遇到"非法请求"自动清 cookies 重试）"""
    # 首次调用的 API 响应会设置 PHPSESSID cookie
    r = api_call('WpLogin/UserInfo', config)
    if r.get('status') == 1:
        return True

    info = r.get('info', '')
    print(f'[validate_token] 失败: info={info}', flush=True)

    # "非法请求"=session 未建立, 清空 cookies 让下次请求重新获取
    if '非法' in str(info):
        run_replica.session.cookies.clear()
        r = api_call('WpLogin/UserInfo', config)
        if r.get('status') == 1:
            return True
        print(f'[validate_token] 重试依然失败: {r}', flush=True)

    return False


# ── OSS ──────────────────────────────────────────────────────────────────────

def oss_upload(config, content):
    sts = api_call('WpIndex/getOssSts', config)
    sd = sts.get('data', {})
    akid = sd.get('AccessKeyId', '')
    aksec = sd.get('AccessKeySecret', '')
    stok = sd.get('SecurityToken', '')
    if not akid:
        return None

    enc = run_replica.aes_encrypt(json.dumps(content, separators=(',', ':'), ensure_ascii=False))
    day = time.strftime('%Y-%m-%d', time.localtime())
    key = f'Public/Upload/file/run_record/{day}/{uuid.uuid4().hex}.txt'
    expiry = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(time.time() + 3600))
    policy = json.dumps({'expiration': expiry, 'conditions': [['content-length-range', 0, 1073741824]]})
    pb = base64.b64encode(policy.encode()).decode()
    sig = base64.b64encode(hmac.new(aksec.encode(), pb.encode(), hashlib.sha1).digest()).decode()

    oss_s = requests.Session()
    oss_s.trust_env = False
    files = {
        'key': (None, key), 'policy': (None, pb),
        'OSSAccessKeyId': (None, akid), 'signature': (None, sig),
        'x-oss-security-token': (None, stok),
        'file': ('data.txt', enc.encode(), 'text/plain'),
    }
    r = oss_s.post('https://lptiyu-data.oss-cn-hangzhou.aliyuncs.com', files=files, timeout=30)
    if r.status_code not in (200, 201, 204):
        return None
    return key.split('Public/Upload/file/')[1]


# ── 记录选择 ──────────────────────────────────────────────────────────────────

def _find_file(name):
    p = os.path.join(DIR, name)
    ap = os.path.abspath(p)
    return ap if os.path.exists(ap) else None


def _load_json(name):
    p = _find_file(name)
    if not p:
        raise FileNotFoundError(f'{name} 未找到（应位于 {DIR}）')
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def _gen_step_info(used_time_s):
    interval = 60
    total_slots = used_time_s // interval + 1
    avg = max(10, int(used_time_s * 0.6 / total_slots))
    steps = []
    remaining = max(50, int(used_time_s * 0.6))
    for i in range(total_slots):
        if i == total_slots - 1:
            s = remaining
        else:
            s = max(0, int(avg * random.uniform(0.3, 1.8)))
            s = min(s, remaining - (total_slots - i - 1))
        steps.append(s)
        remaining -= s
    if remaining > 0:
        steps[-1] += remaining
    return {'interval': interval, 'list': steps}


# 配速随机范围：每公里 5~7 分钟（300~420 秒/公里）
PACE_MIN_S = 300
PACE_MAX_S = 420


def _finalize_record(rec):
    """随机化本次跑步配速（每公里 5~7 分钟），距离/路线等复刻原记录。

    总时长 = 距离 × 配速；无论来源是缓存还是 all_records.json，
    最终用时都以本函数为准（缓存旧值直接覆盖）。
    """
    rec = dict(rec)
    dist_km = float(rec['distance'])
    pace_s = random.randint(PACE_MIN_S, PACE_MAX_S)   # 秒/公里
    rec['distance'] = dist_km
    rec['used_time'] = int(round(dist_km * pace_s))  # 总时长（秒）
    rec['pace'] = pace_s
    rec['step_info'] = _gen_step_info(rec['used_time'])
    rec['step_num'] = sum(rec['step_info']['list'])
    return rec


def pick_record():
    """随机选一条参考记录（用于倒计时时长 / 距离 / 步数）。

    优先读取 records_params_cache.json，其次 all_records.json（自己导出的记录），
    都没有时退回内置合成记录，保证首次运行即可用。
    """
    cache_path = _find_file('records_params_cache.json')
    if cache_path:
        try:
            with open(cache_path, encoding='utf-8') as f:
                cache = json.load(f)
            # 过滤格式不兼容/损坏的缓存条目（旧格式记录只有 time 字段、缺 used_time）
            valid_cache = [
                r for r in (cache.get('records') or [])
                if isinstance(r, dict) and r.get('used_time') and r.get('game_id')
            ]
            if valid_cache:
                return _finalize_record(random.choice(valid_cache))
        except Exception:
            pass

    try:
        records = _load_json('all_records.json')
    except FileNotFoundError:
        records = []

    valid = [r for r in records if int(r.get('record_status', 0)) == 1]
    if not valid:
        # 无本地记录 → 合成一条：距离在 [2.00, 2.40] km 区间随机，
        # 配速与用时由 _finalize_record 随机生成
        dist_km = round(random.uniform(2.00, 2.40), 2)
        return _finalize_record({'id': 'synthetic', 'distance': dist_km, 'game_id': '1874'})

    params_list = []
    for r in valid:
        start = int(r.get('start_time', 0))
        end = int(r.get('end_time', 0))
        used_time = max(600, end - start) if end > start else 0
        if used_time == 0:
            continue
        dist = float(r.get('distance', 2.0))
        params_list.append({
            'id': r['id'],
            'distance': dist,
            'used_time': used_time,
            'game_id': r.get('game_id', '1874'),
        })
    for p in params_list:
        p['step_info'] = _gen_step_info(p['used_time'])
        p['step_num'] = sum(p['step_info']['list'])

    try:
        cache_data = {'count': len(params_list), 'records': params_list, 'built_at': time.time()}
        with open(os.path.join(DIR, 'records_params_cache.json'), 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    return _finalize_record(random.choice(params_list)) if params_list else None


def pick_record_for_route(game_id):
    """按路线 game_id 选取一条有效记录，用于预选倒计时时长。

    直接筛选缓存中 game_id 匹配的记录（避免随机采样 100 次仍可能 miss，
    导致倒计时/距离落到其它场地的记录上）。
    """
    cache_path = _find_file('records_params_cache.json')
    if cache_path:
        try:
            with open(cache_path, encoding='utf-8') as f:
                cache = json.load(f)
            valid = [r for r in (cache.get('records') or [])
                     if isinstance(r, dict) and r.get('used_time') and r.get('game_id')]
            matches = [r for r in valid if str(r.get('game_id')) == str(game_id)]
            if matches:
                return _finalize_record(random.choice(matches))
        except Exception:
            pass
    # 没有匹配记录时回退到任意一条（保持原行为）
    return pick_record()


# ── 路线注册表 ─────────────────────────────────────────────────────────────────

ROUTES = {
    'first_field': {
        'label': '第一运动场',
        'game_id': '1874',
        'template': '_first_field_route.json',
        'ready': True,
        'checkpoints': [
            {'id': '22643', 'distance': 0.18, 'lat': 29.823594292535, 'lng': 106.43120958116},
            {'id': '22644', 'distance': 0.78, 'lat': 29.823829210069, 'lng': 106.43032063802},
            {'id': '24282', 'distance': 1.42, 'lat': 29.823857421875, 'lng': 106.43111300998},
            {'id': '24283', 'distance': 2.07, 'lat': 29.823061794705, 'lng': 106.43065212674},
        ],
    },
    'third_field': {
        'label': '第四运动场',
        'game_id': '1875',
        'template': '_third_field_route.json',
        'ready': True,
        # 打卡点来自历史记录 detail 的 point_list（真实 ID：22645/22646/24280/24281）
        'checkpoints': [
            {'id': '22645', 'distance': 0.18, 'lat': 29.817009548611, 'lng': 106.42134955512},
            {'id': '24281', 'distance': 0.78, 'lat': 29.816201985677, 'lng': 106.420625},
            {'id': '22646', 'distance': 1.42, 'lat': 29.815573730469, 'lng': 106.4208610026},
            {'id': '24280', 'distance': 2.07, 'lat': 29.816343044705, 'lng': 106.42154378255},
        ],
    },
    'second_field': {
        'label': '第二运动场',
        'game_id': '1873',
        'template': '_second_field_route.json',
        'ready': True,
        # 打卡点来自 beforeRunV260 的 run_line_info.point_list（真实 ID：22641/22642/24284/24285）
        'checkpoints': [
            {'id': '22641', 'distance': 0.18, 'lat': 29.825441, 'lng': 106.428002},
            {'id': '22642', 'distance': 0.78, 'lat': 29.825990, 'lng': 106.427020},
            {'id': '24284', 'distance': 1.42, 'lat': 29.825930, 'lng': 106.427876},
            {'id': '24285', 'distance': 2.07, 'lat': 29.825292, 'lng': 106.427264},
        ],
    },
    'rongchang': {
        'label': '荣昌校区',
        'game_id': '1876',
        'template': '_first_field_route.json',
        'ready': False,
        # 荣昌暂不启用：打卡点用占位值（真实点 22647~22652 已确认但用户暂不需要）
        'checkpoints': [
            {'id': '22643', 'distance': 0.18, 'lat': 29.405000, 'lng': 105.598000},
            {'id': '22644', 'distance': 0.78, 'lat': 29.405500, 'lng': 105.598500},
            {'id': '24282', 'distance': 1.42, 'lat': 29.405300, 'lng': 105.599000},
            {'id': '24283', 'distance': 2.07, 'lat': 29.404800, 'lng': 105.598300},
        ],
    },
}


# ── 提交跑步 ──────────────────────────────────────────────────────────────────

def _normalize_record_status(status, reason):
    """乐跑对「当天关联成绩已达上限」返回 record_status=0，业务上按失败处理。"""
    try:
        status = int(status if status is not None else 0)
    except (TypeError, ValueError):
        status = 0
    if status == 0 and reason and '上限' in str(reason):
        return 2
    return status


def submit_run(config, route_name='first_field', pre_record=None):
    """执行一次跑步提交。route_name 指定路线（ROUTES 中的 key），pre_record 为预选的记录（跳过随机选取）。
    返回 {status, record_id, distance, reason, raw}"""
    route = ROUTES.get(route_name)
    if not route:
        return {'status': 0, 'error': f'无效路线: {route_name}'}

    # 1. OSS 轨迹上传（使用路线对应的轨迹模板）
    oss_template = _load_json(route['template'])
    fresh_oss = []
    for pt in oss_template:
        np = {
            'a': round(pt['a'] + random.uniform(-0.000003, 0.000003), 6),
            'o': round(pt['o'] + random.uniform(-0.000003, 0.000003), 6),
        }
        if 's' in pt:
            np['s'] = round(max(0, pt['s'] + random.uniform(-0.1, 0.1)), 2)
        if 'b' in pt:
            np['b'] = pt['b']
        if 'c' in pt:
            np['c'] = pt['c']
        fresh_oss.append(np)

    rf = oss_upload(config, fresh_oss)
    if not rf:
        return {'status': 0, 'error': 'OSS 上传失败'}

    # 2. 使用预选记录（或随机选取一条历史记录作参考）
    rec = pre_record or pick_record()
    if not rec:
        return {'status': 0, 'error': '无有效记录可供参考'}
    game_id = route['game_id']
    dist_km = rec['distance']
    used_time_s = rec['used_time']
    step_info = rec['step_info']
    step_num = rec['step_num']

    # 3. 构造打卡点日志（按总距离比例分布全程，防短时跑步产生未来时间戳）
    dt_now = int(time.time())
    start_t = dt_now - used_time_s - 180
    cp_list = route['checkpoints']

    log_entries = []
    for cp in cp_list:
        frac = cp['distance'] / dist_km
        t_offset = min(int(used_time_s * frac), used_time_s - 60)
        t = start_t + t_offset
        log_entries.append({
            'distance': cp['distance'],
            'latitude': cp['lat'],
            'longitude': cp['lng'],
            'point_id': cp['id'],
            'time': t,
            'longtitude': cp['lng'],
        })

    # 4. 提交
    dev_id, dev_model, dev_os = get_device_info(config)
    rd = {
        'term_id': str(config.get('term_id') or '0'),
        'game_id': game_id,
        'start_time': start_t,
        'end_time': dt_now,
        'log_data': json.dumps(log_entries, separators=(',', ':'), ensure_ascii=False),
        'file_img': '',
        'is_running_area_valid': 1,
        'mobileDeviceId': dev_id, 'mobileModel': dev_model, 'mobileOsVersion': dev_os,
        'step_info': json.dumps(step_info, separators=(',', ':'), ensure_ascii=False),
        'step_num': step_num, 'used_time': used_time_s,
        'distance': dist_km, 'record_img': '', 'record_file': rf,
    }

    result = api_call('Run/stopRunV278', config, rd)
    d = result.get('data', {})

    reason_raw = d.get('record_failed_reason', '')
    try:
        reason = reason_raw.encode('latin-1').decode('gbk')
    except Exception:
        reason = reason_raw

    return {
        'status': _normalize_record_status(d.get('record_status', 0), reason),
        'record_id': d.get('record_id', ''),
        'distance': dist_km,
        'used_time': used_time_s,
        'reason': reason,
        'raw': d,
    }


# ── 获取用户历史记录 ────────────────────────────────────────────────────────


def get_term_list(config):
    """获取该账号可选学期列表（含 term_id / term_name / current）。

    乐跑接口 WpRun/getTermList 用 status=1 标记当前学期；没有该字段时
    退回「第一项为当前学期」。返回前把当前学期排到最前，便于前端默认选中。
    """
    result = api_call('WpRun/getTermList', config)
    if result.get('status') != 1:
        info = result.get('info', result.get('msg', '获取学期列表失败'))
        raise Exception(f'{info}')
    data = result.get('data') or []
    terms = []
    if isinstance(data, list):
        for i, t in enumerate(data):
            if not isinstance(t, dict):
                continue
            tid = t.get('term_id')
            if tid in (None, ''):
                continue
            raw_status = str(t.get('status') if t.get('status') is not None else '').strip()
            terms.append({
                'term_id': str(tid),
                'term_name': str(t.get('term_name') or ''),
                # 优先用乐跑返回的 status == '1'；缺失时退回"第一项为当前"
                'current': (raw_status == '1') if raw_status else (i == 0),
            })
    # 兜底：一个当前学期都没识别出来时，把第一项标为当前
    if terms and not any(t['current'] for t in terms):
        terms[0]['current'] = True
    # 当前学期排最前（稳定排序，其余保持原顺序）
    terms.sort(key=lambda t: 0 if t['current'] else 1)
    return terms


def get_user_records(config, days=30, max_pages=5, target_ok=10, term_id=None):
    """获取用户最近 N 天的成功与失败记录（用于前端展示和选择）。

    term_id 指定时按该学期拉取（默认跟随 config 的学期）；
    循环翻页拉取（乐跑 API 固定每页 10 条，忽略 size 参数），
    攒够 target_ok 条 status=1 的记录或翻完 max_pages 页后停止。
    指定学期时不按天数截断（学期内全部记录都展示）。
    """
    cfg = config
    if term_id is not None and str(term_id) != str(config.get('term_id', '')):
        cfg = dict(config)
        cfg['term_id'] = str(term_id)
    cutoff = 0 if term_id is not None else int(time.time()) - days * 86400
    out = []
    ok_count = 0
    for page in range(1, max_pages + 1):
        if page > 1:
            time.sleep(0.3)
        result = api_call('WpRun/getTermRunRecord', cfg, {'page': page, 'size': 50})
        if result.get('status') != 1:
            info = result.get('info', result.get('msg', '请求失败'))
            raise Exception(f'{info}')
        rec_list = result.get('data', {}).get('list', [])
        if not rec_list:
            break
        past_cutoff = False
        for r in rec_list:
            st = int(r.get('start_time', 0))
            if st < cutoff:
                past_cutoff = True
                continue
            status = r.get('record_status', '')
            out.append({
                'id': r.get('id', ''),
                'status': status,
                'distance': r.get('distance', ''),
                'used_time': r.get('used_time', r.get('time', '')),
                'start_time': st,
                'title': r.get('title', ''),
                'game_id': r.get('game_id', ''),
            })
            if str(status) == '1':
                ok_count += 1
        if past_cutoff or ok_count >= target_ok:
            break
    out.sort(key=lambda x: x['start_time'], reverse=True)
    return out


# ── 使用历史记录提交跑步 ────────────────────────────────────────────────────


def _oss_download(config, oss_url):
    """从 lptiyu OSS 下载并解密轨迹数据。返回轨迹列表。"""
    from urllib.parse import urlparse
    sts = api_call('WpIndex/getOssSts', config)
    sd = sts.get('data', {})
    akid = sd.get('AccessKeyId', '')
    aksec = sd.get('AccessKeySecret', '')
    stok = sd.get('SecurityToken', '')
    region = sd.get('Region', 'oss-cn-hangzhou')
    bucket_name = sd.get('Bucket', 'lptiyu-data')

    import oss2
    from oss2.http import Session as OssSession
    oss_session = OssSession()
    s = requests.Session()
    s.trust_env = False
    oss_session.session = s
    auth = oss2.StsAuth(akid, aksec, stok)
    bucket = oss2.Bucket(auth, f'https://{region}.aliyuncs.com', bucket_name, session=oss_session)

    key = urlparse(oss_url).path.lstrip('/')
    obj = bucket.get_object(key)
    raw = obj.read().decode('utf-8').strip()
    decrypted = run_replica.aes_decrypt(raw)
    return json.loads(decrypted)


def submit_using_record(config, record_id, route_name='first_field'):
    """使用用户某条历史记录的 GPS 轨迹提交跑步。

    record_id 来自 get_user_records() 的 id 字段。
    """
    route = ROUTES.get(route_name)
    if not route:
        return {'status': 0, 'error': f'无效路线: {route_name}'}

    # 1. 获取记录详情（含 OSS URL）
    detail = api_call('Run/recordDetailV270', config, {'record_id': str(record_id)})
    if detail.get('status') != 1:
        return {'status': 0, 'error': '获取记录详情失败'}
    d = detail.get('data', {})
    oss_url = d.get('file', '')
    if not oss_url:
        return {'status': 0, 'error': '该记录没有轨迹文件'}
    record_status = d.get('record_status')
    if str(record_status) not in ('1',):
        return {'status': 0, 'error': '只能选择成功的记录'}

    # 2. 下载该记录的真实 GPS 轨迹
    try:
        real_traj = _oss_download(config, oss_url)
    except Exception as e:
        return {'status': 0, 'error': f'轨迹下载失败: {e}'}

    # 3. 微调轨迹（避免被判重）
    fresh_oss = []
    for pt in real_traj:
        np = {
            'a': round(pt['a'] + random.uniform(-0.000003, 0.000003), 6),
            'o': round(pt['o'] + random.uniform(-0.000003, 0.000003), 6),
        }
        if 's' in pt:
            np['s'] = round(max(0, pt['s'] + random.uniform(-0.1, 0.1)), 2)
        if 'b' in pt:
            np['b'] = pt['b']
        if 'c' in pt:
            np['c'] = pt['c']
        fresh_oss.append(np)

    # 4. 上传 OSS
    rf = oss_upload(config, fresh_oss)
    if not rf:
        return {'status': 0, 'error': 'OSS 上传失败'}

    # 5. 使用记录的真实元数据（优先取历史记录本身的 game_id，兼容旧数据）
    game_id = d.get('game_id') or route['game_id']
    dist_km = str(d.get('distance', '0'))
    used_time_s = int(float(d.get('time', 0)))
    if used_time_s <= 0:
        return {'status': 0, 'error': '无效的用时数据'}

    # 生成 step_info
    step_info = _gen_step_info(used_time_s)
    step_num = sum(step_info['list'])

    # 6. 构造打卡点日志（按总距离比例分布全程）
    dt_now = int(time.time())
    start_t = dt_now - used_time_s - 180
    cp_list = route['checkpoints']
    log_entries = []
    for cp in cp_list:
        frac = cp['distance'] / float(dist_km)
        t_offset = min(int(used_time_s * frac), used_time_s - 60)
        t = start_t + t_offset
        log_entries.append({
            'distance': cp['distance'],
            'latitude': cp['lat'],
            'longitude': cp['lng'],
            'point_id': cp['id'],
            'time': t,
            'longtitude': cp['lng'],
        })

    # 7. 提交
    dev_id, dev_model, dev_os = get_device_info(config)
    rd = {
        'term_id': str(config.get('term_id') or '0'),
        'game_id': game_id,
        'start_time': start_t,
        'end_time': dt_now,
        'log_data': json.dumps(log_entries, separators=(',', ':'), ensure_ascii=False),
        'file_img': '',
        'is_running_area_valid': 1,
        'mobileDeviceId': dev_id, 'mobileModel': dev_model, 'mobileOsVersion': dev_os,
        'step_info': json.dumps(step_info, separators=(',', ':'), ensure_ascii=False),
        'step_num': step_num, 'used_time': used_time_s,
        'distance': dist_km, 'record_img': '', 'record_file': rf,
    }
    result = api_call('Run/stopRunV278', config, rd)
    rd_data = result.get('data', {})

    reason_raw = rd_data.get('record_failed_reason', '')
    try:
        reason = reason_raw.encode('latin-1').decode('gbk')
    except Exception:
        reason = reason_raw

    return {
        'status': _normalize_record_status(rd_data.get('record_status', 0), reason),
        'record_id': rd_data.get('record_id', ''),
        'distance': dist_km,
        'reason': reason,
        'raw': rd_data,
    }