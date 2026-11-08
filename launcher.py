# -*- coding: utf-8 -*-
"""跑步助手 一键启动器。

检测 Python → 创建虚拟环境 → 安装依赖 → 检查/构建前端 → 启动服务 → 打开浏览器。

由 start.bat / start.sh 调用；Windows 与 macOS / Linux 共用同一套逻辑。
"""
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser

BASE = os.path.dirname(os.path.abspath(__file__))
VENV = os.path.join(BASE, '.venv')
IS_WIN = os.name == 'nt'
VENV_PY = (os.path.join(VENV, 'Scripts', 'python.exe') if IS_WIN
           else os.path.join(VENV, 'bin', 'python'))
URL = 'http://127.0.0.1:5000'
LINE = '=' * 44


def say(msg=''):
    print(msg, flush=True)


def ensure_venv():
    if os.path.isfile(VENV_PY):
        say('[1/4] 虚拟环境已就绪')
        return True
    say('[1/4] 首次运行，正在创建虚拟环境...')
    try:
        import venv
        venv.create(VENV, with_pip=True)
    except Exception as exc:  # noqa: BLE001
        say('[错误] 创建虚拟环境失败：%s' % exc)
        return False
    if not os.path.isfile(VENV_PY):
        say('[错误] 虚拟环境创建后仍找不到 Python 解释器')
        return False
    return True


def ensure_deps():
    marker = os.path.join(VENV, '.deps_ok')
    if os.path.isfile(marker):
        say('[2/4] 依赖已就绪')
        return True
    say('[2/4] 正在安装依赖（首次较慢，请耐心等待）...')
    cmd = [VENV_PY, '-m', 'pip', 'install', '-q',
           '-r', os.path.join(BASE, 'requirements.txt'),
           '--disable-pip-version-check']
    try:
        subprocess.check_call(cmd)
    except subprocess.CalledProcessError:
        say('[错误] 依赖安装失败，请检查网络后重试')
        return False
    try:
        with open(marker, 'w', encoding='utf-8') as fh:
            fh.write('ok')
    except OSError:
        pass
    return True


def ensure_frontend():
    dist_index = os.path.join(BASE, 'user-portal', 'dist', 'index.html')
    if os.path.isfile(dist_index):
        say('[3/4] 前端产物已就绪')
        return True

    npm = shutil.which('npm')
    if not npm:
        say('[错误] 缺少前端构建产物 user-portal/dist')
        say('请下载带 dist 的 Release 包，或安装 Node.js 后执行：')
        say('    cd user-portal')
        say('    npm install')
        say('    npm run build')
        return False

    say('[3/4] 未找到前端产物，正在自动构建（首次较慢）...')
    portal = os.path.join(BASE, 'user-portal')
    try:
        subprocess.check_call([npm, 'install', '--no-audit', '--no-fund'], cwd=portal)
        subprocess.check_call([npm, 'run', 'build'], cwd=portal)
    except subprocess.CalledProcessError:
        say('[错误] 前端构建失败')
        return False
    if not os.path.isfile(dist_index):
        say('[错误] 前端构建后仍找不到 user-portal/dist/index.html')
        return False
    return True


def open_browser_later():
    def _run():
        time.sleep(2.5)
        try:
            webbrowser.open(URL)
        except Exception:  # noqa: BLE001
            pass
    threading.Thread(target=_run, daemon=True).start()


def main():
    say(LINE)
    say('            跑步助手  启动器')
    say(LINE)
    say()

    if sys.version_info < (3, 8):
        say('[错误] 需要 Python 3.8 或更高版本，当前为 %s' % sys.version.split()[0])
        return 1

    if not ensure_venv():
        return 1
    if not ensure_deps():
        return 1
    if not ensure_frontend():
        return 1

    say('[4/4] 正在启动服务：%s' % URL)
    say()
    say('关闭本窗口即可停止服务。')
    say(LINE)
    say()

    open_browser_later()
    os.chdir(BASE)
    try:
        return subprocess.call([VENV_PY, os.path.join(BASE, 'app.py')])
    except KeyboardInterrupt:
        return 0


if __name__ == '__main__':
    sys.exit(main())
