# 乐跑模拟器

> ⚠️ **本项目仅供学习与研究，请勿用于违反校规、作弊或任何违法用途。使用风险自负。**
>
> 请自行准备乐跑账号并在本地运行，作者不对任何使用后果负责。

一个**本地运行**的乐跑（lptiyu）跑步记录模拟工具，专注于核心能力，不包含：

- ❌ 邮箱注册 / 登录 / 验证码
- ❌ 支付与虚拟币
- ❌ 管理后台 / 公告 / 用户体系
- ❌ 对外暴露的私有密钥与第三方服务凭据

核心能力：

- ✅ 抓包配置导入（解密乐跑请求 `data` 参数）
- ✅ 多场地轨迹模板（第一 / 第二 / 第四运动场）
- ✅ 按真实记录的配速与里程生成跑步数据并提交
- ✅ 复用历史记录的 GPS 轨迹提交

## 目录结构

```
.
├── app.py               # Flask API
├── config.py            # 运行配置（环境变量覆盖）
├── protocol.py          # 乐跑协议常量（可被环境变量覆盖）
├── run_replica.py       # 乐跑 API 客户端（加密 / 签名 / 请求）
├── crypto_util.py       # 加解密（抓包解密 + token 本地加密）
├── runner.py            # 核心逻辑（OSS 上传 / 提交 / 历史记录）
├── storage.py           # 本地 SQLite（配置 / 提交记录）
├── static/index.html    # 未构建前端时的内置说明页
├── user-portal/         # Web 前端（React 18 + Vite + Tailwind）
├── _first_field_route.json
├── _second_field_route.json
├── _third_field_route.json
└── tests/test_smoke.py
```

## 快速开始

```bash
# 1. 安装后端依赖（建议使用虚拟环境）
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# 2. 构建前端（首次运行或前端有改动时）
cd user-portal
npm install
npm run build
cd ..

# 3. 启动（默认只监听 127.0.0.1:5000）
python app.py
```

打开 <http://127.0.0.1:5000> 即可使用 Web 界面。

### 前端开发

```bash
cd user-portal
npm install
npm run dev      # http://localhost:5173，自动把 /api 代理到 :5000
```

### 使用流程

1. **抓包**：用浏览器开发者工具或抓包工具，获取乐跑请求中的 `data` 参数（一整段 base64 密文，通常出现在 `curl` 命令里）。
2. **导入配置**：

   ```bash
   curl -X POST http://127.0.0.1:5000/api/capture/import \
        -H 'Content-Type: application/json' \
        -d '{"raw_body": "<整条 curl 或 data=...>"}'

   curl -X POST http://127.0.0.1:5000/api/capture/save \
        -H 'Content-Type: application/json' \
        -d '{"uid":"...","token":"...","student_num":"...","school_id":"837","term_id":"0","class_id":0,"card_id":"..."}'
   ```

3. **查看场地**：

   ```bash
   curl http://127.0.0.1:5000/api/routes
   ```

4. **提交**（直接提交，无倒计时）：

   ```bash
   curl -X POST http://127.0.0.1:5000/api/submit \
        -H 'Content-Type: application/json' -d '{"route":"first_field"}'
   ```

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config` | 运行状态与声明 |
| GET | `/api/routes` | 可用场地列表 |
| GET | `/api/runs` | 最近的提交记录 |
| GET | `/api/capture/config` | 查看已保存配置（token 打码） |
| DELETE | `/api/capture/config` | 清除配置 |
| POST | `/api/capture/import` | 解析抓包 `data`（不保存） |
| POST | `/api/capture/save` | 保存乐跑配置 |
| POST | `/api/capture/terms` | 可选学期列表 |
| POST | `/api/capture/records` | 历史跑步记录 |
| POST | `/api/submit` | 提交跑步 |
| POST | `/api/submit/with-record` | 用某条历史记录的轨迹提交 |

## 场地与轨迹

| 场地 | game_id | 轨迹模板 |
|---|---|---|
| 第一运动场 | 1874 | `_first_field_route.json` |
| 第二运动场 | 1873 | `_second_field_route.json` |
| 第四运动场 | 1875 | `_third_field_route.json` |

轨迹为真实记录的 GPS 点序列（`a`=纬度, `o`=经度, `s`=速度, `c`=质量值），提交时叠加小幅随机噪声并随机化配速（5~7 分钟/公里）。

## 配置

全部通过环境变量覆盖，均非必填：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `5000` | 端口 |
| `DB_PATH` | `./data.db` | SQLite 路径 |
| `FRONTEND_DIST` | `./user-portal/dist` | 前端 dist 目录（可用自己的构建产物覆盖）|
| `MAX_CONTENT_LENGTH` | `2097152` | 请求体上限（字节） |
| `LPTIYU_API_BASE` | 官方地址 | 乐跑接口 |
| `LPTIYU_AES_KEY` / `LPTIYU_AES_IV` / `LPTIYU_SIGN_KEY` | 协议常量 | 如官方更换密钥可覆盖 |

## 前端

仓库内置 `user-portal/`（React 18 + Vite + Tailwind），`npm run build` 后由后端直接托管。
若想用自己的前端，把 `FRONTEND_DIST` 指向你的 dist 目录即可：

```bash
FRONTEND_DIST=/path/to/dist python app.py
```

## 免责声明

- 本项目仅供**学习与研究**（Flask / 逆向 / 加密协议）使用。
- **禁止商用**：不得出售、出租、收费代跑、打包转售或以本项目为基础提供付费服务。
- 使用本项目可能违反学校规定，甚至触及法律风险，请自行评估并承担全部后果。
- 请勿将本项目用于代跑、刷成绩、商业牟利等行为。
- 作者不对任何账号封禁、成绩取消、法律纠纷等后果负责。

## License

MIT
