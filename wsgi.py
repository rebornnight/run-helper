"""Gunicorn 入口：

    gunicorn -w 1 -b 127.0.0.1:5000 wsgi:app
"""
from app import _bootstrap, app

_bootstrap()  # 初始化本地数据库

__all__ = ['app']
