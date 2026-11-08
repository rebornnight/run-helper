"""加解密工具。

- 本地存储：AES-GCM（随机 nonce），用于加密保存乐跑 token
- 乐跑抓包：AES-CBC，用于解密抓包里的 data 参数

两者共用 protocol.py 里的协议密钥。
"""
import base64
import hashlib
import hmac
import json
import os

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from protocol import AES_IV, AES_KEY, SIGN_KEY

_GCM = AESGCM(AES_KEY)


def aes_encrypt(plaintext: str) -> str:
    """AES-GCM 加密，返回 base64(nonce[12] + ciphertext+tag)。"""
    nonce = os.urandom(12)
    ct = _GCM.encrypt(nonce, plaintext.encode('utf-8'), None)
    return base64.b64encode(nonce + ct).decode('utf-8')


def aes_decrypt(ciphertext_b64: str) -> str:
    """解密：先按 AES-GCM（本地存储）解，失败再按 AES-CBC（乐跑抓包）解。"""
    raw = base64.b64decode(ciphertext_b64)
    if len(raw) > 12:
        try:
            return _GCM.decrypt(raw[:12], raw[12:], None).decode('utf-8')
        except Exception:
            pass
    cipher = Cipher(algorithms.AES(AES_KEY), modes.CBC(AES_IV))
    dec = cipher.decryptor()
    padded = dec.update(raw) + dec.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return (unpadder.update(padded) + unpadder.finalize()).decode('utf-8')


def try_decrypt(data_str):
    """尝试解密并解析 JSON；失败返回 None。"""
    if not data_str or len(data_str) < 20:
        return None
    try:
        return json.loads(aes_decrypt(data_str))
    except Exception:
        return None


def verify_sign(data_str: str, sign_str: str) -> bool:
    """校验 md5(data + SIGN_KEY)，常数时间比较。"""
    expected = hashlib.md5((data_str + SIGN_KEY).encode()).hexdigest()
    return hmac.compare_digest((sign_str or '').lower(), expected.lower())
