# 跑步助手

> ⚠️ **本项目仅供学习与研究，请勿用于违反校规、作弊或任何违法用途。使用风险自负。**
>
> 请自行准备乐跑账号并在**本地**运行，作者不对任何使用后果负责。**禁止商用**。

一个在本机运行的乐跑（lptiyu）跑步记录模拟工具：导入抓包配置 → 选择场地 → 提交。

- ✅ 抓包配置导入（解密乐跑请求的 `data` 参数）
- ✅ 多场地轨迹模板（第一 / 第二 / 第四运动场）
- ✅ 按真实记录的配速与里程生成数据并提交
- ✅ 复用历史记录的 GPS 轨迹提交
- ✅ 全部数据只存本机 SQLite，token 加密，不上传任何服务器

---

## 目录

1. [环境要求](#一环境要求)
2. [Windows 从零开始](#二windows-从零开始)
3. [macOS / Linux 从零开始](#三macos--linux-从零开始)
4. [首次使用教程](#四首次使用教程)
5. [部署](#五部署)
6. [目录结构](#六目录结构)
7. [API](#七api)
8. [配置项](#八配置项)
9. [常见问题](#九常见问题)
10. [免责声明](#十免责声明)

---

## 一、环境要求

| 项目 | 要求 | 说明 |
|---|---|---|
| Python | **3.8 或更高** | 必须 |
| Node.js | **18 或更高** | 可选，只有从源码构建前端时才需要 |
| 浏览器 | Chrome / Edge 新版 | 推荐 |
| 操作系统 | Windows 10+ / macOS / Linux | — |
| 磁盘 | 约 200 MB | 含依赖与前端产物 |

> 如果你下载的是**带 `dist` 的 Release 包**，只需要 Python，**不需要 Node.js**。

检查是否已安装：

```bash
python --version
```

```bash
node --version
```

---

## 二、Windows 从零开始

### 2.1 安装 Python

1. 打开 [Python 官网下载页](https://www.python.org/downloads/)
2. 下载 **Windows installer (64-bit)**，版本 3.10 ~ 3.12 最稳妥（3.13 / 3.14 也支持）
3. 双击安装包，**务必勾选 ⚠️ `Add Python to PATH`**
4. 点击 `Install Now`，等待完成

验证安装（新开一个 PowerShell 窗口）：

```powershell
python --version
```

看到 `Python 3.x.x` 即成功。若提示"不是内部或外部命令"，说明 PATH 没勾，重新安装。

### 2.2 安装 Node.js（可选）

只有**从源码构建前端**时才需要。如果下载的是带 `dist` 的 Release 包，可跳过。

1. 打开 [Node.js 官网](https://nodejs.org/zh-cn)
2. 下载 **LTS 版本**，一路下一步安装

验证：

```powershell
node --version
```

```powershell
npm --version
```

### 2.3 下载项目

方式一：Git 克隆

```powershell
git clone <你的仓库地址>
```

方式二：下载 Release 包 → 解压到任意目录（例如 `D:\跑步助手`）

进入项目目录：

```powershell
cd D:\跑步助手
```

> 路径里**不要有中文或空格**，避免个别依赖出问题。

### 2.4 一键启动（推荐）

在项目文件夹里**双击 `start.bat`**。

脚本会自动完成：

```
[1/4] 检测 Python → 创建虚拟环境 .venv
[2/4] 安装依赖（首次较慢，约 1~3 分钟）
[3/4] 检查前端产物（缺失且装了 Node.js 会自动构建）
[4/4] 启动服务并自动打开浏览器
```

看到 `Running on http://127.0.0.1:5000` 就表示启动成功，浏览器会自动打开。

**关闭那个黑色命令行窗口 = 停止服务。**

### 2.5 手动启动

不想用 `start.bat`，可以一步步来。

创建虚拟环境：

```powershell
python -m venv .venv
```

激活虚拟环境：

```powershell
.venv\Scripts\activate
```

安装依赖：

```powershell
pip install -r requirements.txt
```

构建前端（仅源码用户需要；Release 包已带 `dist`，跳过此步）：

```powershell
cd user-portal
```

```powershell
npm install
```

```powershell
npm run build
```

```powershell
cd ..
```

启动服务：

```powershell
python app.py
```

浏览器打开：

<http://127.0.0.1:5000>

---

## 三、macOS / Linux 从零开始

### 3.1 安装 Python

macOS（已装 Homebrew 的情况）：

```bash
brew install python@3.12
```

Ubuntu / Debian：

```bash
sudo apt update
```

```bash
sudo apt install -y python3 python3-venv python3-pip
```

CentOS / Rocky：

```bash
sudo dnf install -y python3 python3-pip
```

验证：

```bash
python3 --version
```

### 3.2 安装 Node.js（可选）

macOS：

```bash
brew install node
```

Ubuntu / Debian：

```bash
sudo apt install -y nodejs npm
```

验证：

```bash
node --version
```

### 3.3 下载并启动

克隆项目：

```bash
git clone <你的仓库地址>
```

进入目录：

```bash
cd run_server_opensource
```

给启动脚本加执行权限：

```bash
chmod +x start.sh
```

一键启动：

```bash
./start.sh
```

手动启动方式：

```bash
python3 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

```bash
cd user-portal
```

```bash
npm install
```

```bash
npm run build
```

```bash
cd ..
```

```bash
python app.py
```

浏览器打开 <http://127.0.0.1:5000>。

---

## 四、首次使用教程

### 4.1 打开界面

启动成功后访问：

<http://127.0.0.1:5000>

首次打开会弹出**使用协议**，阅读后点「我已知晓」（点「我不同意并退出」则无法使用）。

左侧菜单：

| 菜单 | 作用 |
|---|---|
| 跑步记录 | 主界面：开始跑步、使用历史记录、查看提交结果 |
| 模拟环境 | 粘贴抓包数据、导入配置 |
| 使用说明 | 图文教程（抓包工具安装到配置导入全流程） |

### 4.2 抓包获取配置

详细图文步骤见界面里的 **「使用说明」**，大致流程：

1. 安装抓包工具 [Reqable](https://reqable.com)（免费版即可）
2. 安装 Reqable 根证书到系统
3. 打开微信 → 进入乐跑小程序 → 随便点几个页面
4. 回到 Reqable，按域名 `api.lptiyu.com` 过滤
5. 右键任意一条请求 → **复制 cURL**
6. 粘贴到「模拟环境」页面的输入框 → 点击「导入配置」

### 4.3 导入配置

在 Web 界面操作即可：

1. 左侧菜单 → **模拟环境**
2. 把复制的 cURL 粘贴到「请求体内容」输入框
3. 点击 **导入配置**
4. 确认解析出的字段（uid / token / 学号 / 学校ID …）后点击 **保存配置**

也可以用命令行：

```bash
curl -X POST http://127.0.0.1:5000/api/capture/import -H "Content-Type: application/json" -d "{\"raw_body\": \"<整条 curl>\"}"
```

```bash
curl -X POST http://127.0.0.1:5000/api/capture/save -H "Content-Type: application/json" -d "{\"uid\":\"...\",\"token\":\"...\",\"student_num\":\"...\",\"school_id\":\"837\",\"term_id\":\"0\",\"class_id\":0,\"card_id\":\"...\"}"
```

### 4.4 提交跑步

方式一（推荐）：Web 界面

1. 左侧菜单 → **跑步记录**
2. 点击 **开始跑步**
3. 选择场地（第一 / 第二 / 第四运动场）
4. 点击 **立即提交**
5. 等待提示「提交成功：X.XX km」

方式二：命令行

```bash
curl -X POST http://127.0.0.1:5000/api/submit -H "Content-Type: application/json" -d "{\"route\":\"first_field\"}"
```

场地代号：

| 场地 | route |
|---|---|
| 第一运动场 | `first_field` |
| 第二运动场 | `second_field` |
| 第四运动场 | `third_field` |

### 4.5 用历史记录提交

1. 「跑步记录」页 → 点击 **使用历史记录**
2. 选择学期（只显示最新 3 个学期）
3. 选择一条成功记录 → 弹出确认窗 → 点击 **确认提交**

---

## 五、部署

> 本项目设计为**本地单用户工具**。以下部署方式仅用于「同一局域网内自己访问」或「自己的服务器自用」。
> **不建议**暴露到公网：它会读取并使用你的乐跑登录凭证。

### 5.1 局域网访问（手机 / 平板也能用）

默认只监听 `127.0.0.1`（仅本机可访问）。改成监听所有网卡：

PowerShell：

```powershell
$env:HOST="0.0.0.0"
```

```powershell
python app.py
```

macOS / Linux：

```bash
export HOST=0.0.0.0
```

```bash
python app.py
```

然后在同一 WiFi 下的设备访问：

```
http://<你电脑的局域网IP>:5000
```

查看本机 IP：

Windows：

```powershell
ipconfig
```

macOS / Linux：

```bash
ifconfig
```

⚠️ 局域网开放后，同网段的人也能访问，请确保只在可信网络下使用。

### 5.2 Linux 服务器部署（gunicorn）

安装 gunicorn：

```bash
pip install gunicorn
```

启动（注意：必须用 `-w 1` 单进程，多进程会导致状态不一致）：

```bash
gunicorn -w 1 -b 127.0.0.1:5000 wsgi:app
```

后台运行：

```bash
nohup gunicorn -w 1 -b 127.0.0.1:5000 wsgi:app > run.log 2>&1 &
```

### 5.3 配置为 systemd 服务（开机自启）

创建服务文件：

```bash
sudo nano /etc/systemd/system/runner.service
```

写入以下内容（把路径改成你的实际路径）：

```ini
[Unit]
Description=Runner Assistant
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/opt/run_server_opensource
Environment="HOST=127.0.0.1"
Environment="PORT=5000"
ExecStart=/opt/run_server_opensource/.venv/bin/gunicorn -w 1 -b 127.0.0.1:5000 wsgi:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

重新加载配置：

```bash
sudo systemctl daemon-reload
```

开机自启：

```bash
sudo systemctl enable runner
```

启动服务：

```bash
sudo systemctl start runner
```

查看状态：

```bash
sudo systemctl status runner
```

查看日志：

```bash
sudo journalctl -u runner -f
```

### 5.4 Nginx 反向代理（可选）

如果你需要域名或 HTTPS，可加一层 Nginx。

安装：

```bash
sudo apt install -y nginx
```

新建配置：

```bash
sudo nano /etc/nginx/sites-available/runner
```

内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/runner /etc/nginx/sites-enabled/
```

检查配置：

```bash
sudo nginx -t
```

重载：

```bash
sudo systemctl reload nginx
```

> 公网部署前请务必想清楚风险：这个工具需要保存你的乐跑 token。

---

## 六、目录结构

```
.
├── app.py                    # Flask 入口与全部 API 路由
├── config.py                 # 运行配置（环境变量覆盖）
├── launcher.py               # 一键启动器（start.bat / start.sh 调用）
├── start.bat                 # Windows 启动脚本
├── start.sh                  # macOS / Linux 启动脚本
├── protocol.py               # 乐跑协议常量（可被环境变量覆盖）
├── run_replica.py            # 乐跑 API 客户端（AES 加解密 / 签名 / 请求）
├── crypto_util.py            # 抓包解密 + token 本地加密
├── runner.py                 # 核心逻辑（OSS 上传 / 轨迹生成 / 提交 / 历史记录）
├── storage.py                # 本地 SQLite（配置 / 提交记录）
├── wsgi.py                   # WSGI 入口（gunicorn 用）
├── static/index.html         # 未构建前端时的内置说明页
├── user-portal/              # Web 前端（React 18 + Vite + Tailwind）
│   ├── src/                  # 前端源码
│   ├── public/guide/         # 使用说明配图
│   └── dist/                 # 构建产物（后端直接托管）
├── _first_field_route.json   # 第一运动场轨迹模板
├── _second_field_route.json  # 第二运动场轨迹模板
├── _third_field_route.json   # 第四运动场轨迹模板
├── tests/test_smoke.py       # 冒烟测试
├── requirements.txt
├── .env.example
└── data.db                   # 首次启动自动生成（已 gitignore）
```

---

## 七、API

所有接口都在 `http://127.0.0.1:5000` 下，请求/响应均为 JSON。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config` | 运行状态与声明 |
| GET | `/api/routes` | 可用场地列表 |
| GET | `/api/runs` | 最近的提交记录 |
| GET | `/api/capture/config` | 查看已保存配置（token 打码） |
| DELETE | `/api/capture/config` | 清除配置 |
| POST | `/api/capture/import` | 解析抓包 `data`（只解析，不保存） |
| POST | `/api/capture/save` | 保存乐跑配置 |
| POST | `/api/capture/terms` | 可选学期列表 |
| POST | `/api/capture/records` | 某学期的历史跑步记录 |
| POST | `/api/submit` | 提交跑步（用模板轨迹） |
| POST | `/api/submit/with-record` | 用某条历史记录的轨迹提交 |

调用示例：

```bash
curl http://127.0.0.1:5000/api/routes
```

```bash
curl http://127.0.0.1:5000/api/runs
```

```bash
curl -X POST http://127.0.0.1:5000/api/submit -H "Content-Type: application/json" -d "{\"route\":\"first_field\"}"
```

---

## 八、配置项

全部通过**环境变量**覆盖，均非必填。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | 监听地址，局域网访问改 `0.0.0.0` |
| `PORT` | `5000` | 端口 |
| `DB_PATH` | `./data.db` | SQLite 数据库路径 |
| `FRONTEND_DIST` | `./user-portal/dist` | 前端构建产物目录 |
| `MAX_CONTENT_LENGTH` | `2097152` | 请求体上限（字节，默认 2MB） |
| `LPTIYU_API_BASE` | 官方地址 | 乐跑接口地址 |
| `LPTIYU_AES_KEY` | 协议常量 | AES 密钥 |
| `LPTIYU_AES_IV` | 协议常量 | AES IV |
| `LPTIYU_SIGN_KEY` | 协议常量 | 签名盐 |

修改端口示例：

PowerShell：

```powershell
$env:PORT="8080"
```

```powershell
python app.py
```

macOS / Linux：

```bash
PORT=8080 python app.py
```

---

## 九、常见问题

### Q1：提示「未检测到 Python」

安装 Python 时没有勾选 `Add Python to PATH`。重新运行安装包 → 选 `Modify` → 勾选 `Add Python to environment variables`。

验证（新开终端）：

```powershell
python --version
```

### Q2：端口 5000 被占用

换一个端口：

```powershell
$env:PORT="5001"
```

```powershell
python app.py
```

或查看谁占用了 5000：

```powershell
netstat -ano | findstr :5000
```

### Q3：页面打开是空白 / 404

说明缺少前端产物 `user-portal/dist`。

源码用户请构建：

```powershell
cd user-portal
```

```powershell
npm install
```

```powershell
npm run build
```

或直接下载**带 dist 的 Release 包**。

### Q4：依赖安装很慢 / 失败

换国内镜像源：

```powershell
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q5：提示「登录信息已失效，请重新模拟」

乐跑 token 过期了（通常是**在其它设备登录了同一个小程序账号**，或太久没用）。

重新抓包 → 「模拟环境」→ 重新导入配置即可。

### Q6：数据存在哪里？怎么彻底清除？

全部在本机 `data.db`（SQLite）。

删除文件即可恢复出厂状态：

```powershell
del data.db
```

macOS / Linux：

```bash
rm data.db
```

浏览器里的「已同意使用协议」标记在 localStorage，可通过浏览器开发者工具清除：

```javascript
localStorage.removeItem('run_sim_terms_accepted_v1')
```

### Q7：怎么跑测试

```powershell
python -m pytest tests/ -q
```

### Q8：前端怎么二次开发

```powershell
cd user-portal
```

```powershell
npm install
```

```powershell
npm run dev
```

开发服务器在 <http://localhost:5173>，`/api` 会自动代理到 `:5000`。

---

## 十、免责声明

- 本项目仅供**学习与研究**（Flask / 前端 / 逆向 / 加密协议）使用。
- **禁止商用**：不得出售、出租、收费代跑、打包转售或以本项目为基础提供付费服务。
- 使用本项目可能违反学校规定，甚至触及法律风险，请自行评估并承担全部后果。
- 请勿将本项目用于代跑、刷成绩、商业牟利等行为。
- 本项目按「现状」提供，不提供任何明示或暗示的担保。
- 作者不对任何账号封禁、成绩取消、数据丢失、法律纠纷等后果负责。

## License

[MIT](LICENSE)
