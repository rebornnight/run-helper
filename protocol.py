"""乐跑（lptiyu）协议常量。

这些常量来自乐跑客户端（微信小程序 / App）的协议实现，属于协议细节，
不是本项目作者的私有凭据。可通过环境变量覆盖：

    LPTIYU_API_BASE / LPTIYU_AES_KEY / LPTIYU_AES_IV / LPTIYU_SIGN_KEY

若官方更换密钥，需要同步更新。
"""
import os

API_BASE = os.environ.get('LPTIYU_API_BASE', 'https://api2.lptiyu.com/v3/api.php')

# 请求参数 AES-CBC 加密密钥（来自客户端）
AES_KEY = os.environ.get('LPTIYU_AES_KEY', 'Wet2C8d34f62ndi3').encode()
AES_IV = os.environ.get('LPTIYU_AES_IV', 'K6iv85jBD8jgf32D').encode()

# 请求签名盐（sign = md5(按 key 排序拼接的参数 + SIGN_KEY)）
SIGN_KEY = os.environ.get('LPTIYU_SIGN_KEY', 'rDJiNB9j7vD2')
