"""乐跑 API 客户端：加密 / 签名 / 请求。

- 请求参数为 AES-CBC 加密的 JSON
- 签名 sign = md5(按 key 排序拼接的参数 + SIGN_KEY)
- 使用 curl_cffi 模拟 Chrome TLS 指纹，以通过乐跑的 WAF 校验
"""
import base64
import hashlib
import json
import random
import time

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from curl_cffi.requests import Session as CffiSession

from protocol import AES_IV, AES_KEY, API_BASE, SIGN_KEY

_UA = (
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005) '
    'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.188 '
    'Mobile Safari/537.36 MicroMessenger/8.0.50.2701(0x2800323B) WeChat/arm64 '
    'Weixin NetType/WIFI Language/zh_CN ABI/arm64'
)

# 模块级共享会话：保持 TLS 指纹与 Cookie（乐跑 WAF 会校验）
session = CffiSession(impersonate='chrome120')
session.headers.update({
    'User-Agent': _UA,
    'Content-Type': 'application/x-www-form-urlencoded',
})


def aes_encrypt(plaintext):
    """AES-CBC 加密（乐跑协议格式，PKCS7）。"""
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext.encode('utf-8')) + padder.finalize()
    cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(AES_IV))
    enc = cipher.encryptor()
    return base64.b64encode(enc.update(padded) + enc.finalize()).decode('utf-8')


def aes_decrypt(ciphertext_b64):
    """AES-CBC 解密（乐跑协议格式）。"""
    raw = base64.b64decode(ciphertext_b64)
    cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(AES_IV))
    dec = cipher.decryptor()
    padded = dec.update(raw) + dec.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return (unpadder.update(padded) + unpadder.finalize()).decode('utf-8')


def sign_md5(params, sign_key=SIGN_KEY):
    """按 key 排序拼接 value，末尾加盐后取 md5。"""
    raw = ''
    for key in sorted(params.keys()):
        value = params[key]
        if isinstance(value, bool):
            value = 'true' if value else 'false'
        elif value is None:
            value = ''
        elif isinstance(value, float) and value == int(value):
            value = int(value)
        raw += f'{key}{value}'
    raw += sign_key
    return hashlib.md5(raw.encode('utf-8')).hexdigest()


def api_call(endpoint, config, extra_params=None):
    """调用乐跑接口，返回解析后的 JSON（status/data/...）。"""
    cfg = config or {}
    params = {
        'uid': str(cfg.get('uid', '')),
        'token': str(cfg.get('token', '')),
        'school_id': str(cfg.get('school_id', '837')),
        'term_id': str(cfg.get('term_id', '0')),
        'student_num': str(cfg.get('student_num', '')),
        'card_id': str(cfg.get('card_id', cfg.get('student_num', ''))),
    }
    params.update({
        'timestamp': int(time.time()),
        'version': 1,
        'nonce': str(random.randint(100000, 999999)),
        'ostype': 5,
        'class_id': int(cfg.get('class_id', 0)),
        'course_id': 0,
    })
    params.update(extra_params or {})
    params['sign'] = sign_md5(params)

    plain = json.dumps(params, separators=(',', ':'), ensure_ascii=False)
    resp = session.post(
        f'{API_BASE}/{endpoint}',
        data={'ostype': 5, 'data': aes_encrypt(plain)},
        timeout=15,
    )
    result = resp.json()
    if result.get('status') == 1:
        encrypted = result.get('data', '')
        if encrypted and len(encrypted) > 10:
            try:
                result['data'] = json.loads(aes_decrypt(encrypted))
            except Exception:
                pass
    return result
