"""运行配置：全部可用环境变量覆盖，默认值适合本地运行。"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# SQLite 数据库路径
DB_PATH = os.environ.get('DB_PATH') or os.path.join(BASE_DIR, 'data.db')

# 监听地址：默认只监听本机，避免把模拟器暴露到公网
HOST = os.environ.get('HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT', '5000'))

# 可选：前端构建产物目录（默认使用仓库内 user-portal/dist）
# 有构建产物时直接托管 SPA；否则返回内置说明页
FRONTEND_DIST = os.environ.get('FRONTEND_DIST') or os.path.join(BASE_DIR, 'user-portal', 'dist')

# 请求体大小上限（默认 2MB）
MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 2 * 1024 * 1024))
