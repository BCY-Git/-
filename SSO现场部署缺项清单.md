# SSO 现场部署缺项清单

本文档用于去现场前确认统一认证对接还缺哪些资料、配置和验证步骤。

## 一、当前系统已经具备的能力

当前版本已经包含独立 `sso` 模块，核心入口如下：

| 用途 | 地址 |
| --- | --- |
| 统一认证登录入口 | `/api/v1/sso/login` |
| 学校统一认证回调后端 | `/api/v1/sso/callback` |
| 前端接收登录 ticket 页面 | `/sso/callback` |
| SSO 配置体检接口 | `/api/v1/sso/config-check` |

现有流程：

```text
学校后台菜单点击本系统链接
→ 访问 /api/v1/sso/login
→ 跳转学校统一认证登录页
→ 学校认证成功后回调 /api/v1/sso/callback
→ 后端换取 access_token 并读取用户信息
→ 自动同步本地用户
→ 后端生成一次性 ticket
→ 前端 /sso/callback 用 ticket 换本系统 JWT
→ 进入本系统工作台
```

安全处理：

- `state` 已校验，用于防止伪造回调。
- 本系统 JWT 不直接出现在浏览器地址栏。
- 前端只拿一次性 `ticket`，并立刻换取 JWT。
- `SSO_CLIENT_SECRET` 只在后端使用，不进入前端代码。
- SSO 新用户默认是普通用户，只有配置了管理员角色 UUID 才会映射为管理员。

## 二、现场必须拿到的资料

| 资料 | 示例 | 说明 |
| --- | --- | --- |
| 学校统一认证根地址 | `https://auth.xxx.edu.cn` | 对应 `SSO_BASE_URL` |
| 应用客户端 ID | `supplier-system` | 对应 `SSO_CLIENT_ID` |
| 应用客户端密钥 | `xxxxxxxx` | 对应 `SSO_CLIENT_SECRET`，只能放后端 `.env` |
| 学校登记的回调地址 | `https://你的域名/api/v1/sso/callback` | 必须和 `SSO_REDIRECT_URI` 完全一致 |
| 获取用户信息接口字段样例 | JSON 示例 | 用于确认字段名是否和文档一致 |
| 管理员角色 UUID | `uuid1,uuid2` | 如需 SSO 用户自动成为管理员才需要 |

## 三、正式环境需要填写的配置

后端 `.env` 至少需要：

```env
DATABASE_URL="file:./supplier_system.db"
JWT_SECRET="使用 openssl rand -hex 32 生成"
INIT_ADMIN_PASSWORD="强初始密码"
CORS_ORIGIN=https://你的前端域名

SSO_BASE_URL=https://学校统一认证域名
SSO_CLIENT_ID=学校分配的客户端ID
SSO_CLIENT_SECRET=学校分配的客户端密钥
SSO_REDIRECT_URI=https://你的域名/api/v1/sso/callback
SSO_FRONTEND_CALLBACK_URL=https://你的域名/sso/callback
SSO_ADMIN_ROLE_UUIDS=管理员角色UUID1,管理员角色UUID2
```

注意：

- 正式环境不要使用 `localhost`。
- `SSO_REDIRECT_URI` 必须和学校统一认证后台登记值完全一致，包括协议、域名、端口、路径。
- `SSO_FRONTEND_CALLBACK_URL` 必须指向前端 `/sso/callback` 页面。
- 如果没有配置 `SSO_ADMIN_ROLE_UUIDS`，统一认证进来的用户都是普通用户。

## 四、学校后台菜单应该配置的跳转链接

建议学校官网后台左侧菜单配置为：

```text
https://你的域名/api/v1/sso/login
```

不要配置为：

```text
https://你的域名/login
```

原因：`/api/v1/sso/login` 会直接启动统一认证流程，用户不需要再看本系统登录页。

## 五、现场联调检查步骤

### 1. 检查后端健康状态

```bash
curl https://你的域名/api/v1/health
```

正常返回：

```json
{"status":"ok"}
```

### 2. 检查 SSO 配置

```bash
curl https://你的域名/api/v1/sso/config-check
```

重点看：

| 字段 | 判断 |
| --- | --- |
| `ok` | `true` 表示基础配置完整 |
| `missing` | 不应有缺失项 |
| `checks.client_secret_configured` | 应为 `true` |
| `checks.sso_redirect_uri.ok` | 应为 `true` |
| `warnings` | 正式环境不应提示 localhost |

说明：该接口不会返回 `SSO_CLIENT_SECRET` 原文。

### 3. 检查是否能跳转学校统一认证

```bash
curl -I https://你的域名/api/v1/sso/login
```

正常情况：

- HTTP 状态为 `302`
- `Location` 指向学校统一认证地址
- URL 中包含 `client_id`、`redirect_uri`、`state`

### 4. 浏览器完整登录

在浏览器访问：

```text
https://你的域名/api/v1/sso/login
```

正常流程：

```text
跳到学校登录页
→ 输入学校账号密码
→ 回到本系统
→ 自动进入工作台
```

## 六、需要现场确认的用户字段

当前系统按以下字段读取学校返回数据：

| 学校字段 | 本系统用途 |
| --- | --- |
| `loginName` | 本地用户名 |
| `userUuid` | 统一认证用户唯一标识 |
| `userName` | 页面显示姓名 |
| `unitUuid` | 单位 UUID |
| `unitName` | 单位名称 |
| `roleUuid` | 判断是否管理员 |
| `email` | 邮箱 |
| `telephone` | 电话 |

如果学校实际返回字段名不同，需要改：

```text
backend/src/sso/sso.service.ts
```

重点方法：

```text
toSyncInput(profile, config)
```

## 七、常见问题和判断方式

| 现象 | 常见原因 | 处理 |
| --- | --- | --- |
| `统一认证未配置完整` | `.env` 缺少 SSO 配置 | 调 `/api/v1/sso/config-check` 看 `missing` |
| 学校提示回调地址不合法 | `SSO_REDIRECT_URI` 和学校登记不一致 | 逐字符比对协议、域名、端口、路径 |
| `state 校验失败` | 登录超时、回调丢 state、JWT_SECRET 变化 | 重新登录，确认后端没有重启换密钥 |
| `统一认证未返回 access_token` | 学校 token 接口返回格式不一致 | 让学校提供实际返回 JSON |
| 获取用户信息失败 | access_token 无效或 profile 接口地址不同 | 确认学校 profile 接口路径和传参方式 |
| 登录后是普通用户 | 未配置 `SSO_ADMIN_ROLE_UUIDS` 或 roleUuid 不匹配 | 用学校返回字段确认 roleUuid |
| 回到前端后登录失败 | `SSO_FRONTEND_CALLBACK_URL` 配错 | 必须是 `https://你的域名/sso/callback` |

## 八、上线前确认清单

- [ ] 后端 `.env` 已配置强 `JWT_SECRET`。
- [ ] `SSO_BASE_URL` 已填写学校正式统一认证地址。
- [ ] `SSO_CLIENT_ID` 已填写。
- [ ] `SSO_CLIENT_SECRET` 已填写，且没有出现在前端代码中。
- [ ] `SSO_REDIRECT_URI` 已在学校后台登记，且和 `.env` 完全一致。
- [ ] `SSO_FRONTEND_CALLBACK_URL` 指向前端 `/sso/callback`。
- [ ] `CORS_ORIGIN` 指向正式前端域名。
- [ ] 学校后台左侧菜单跳转到 `/api/v1/sso/login`。
- [ ] 已拿到学校用户信息返回 JSON 样例。
- [ ] 已确认是否需要配置管理员角色 UUID。
- [ ] 正式环境使用 HTTPS。
- [ ] `/api/v1/sso/config-check` 返回 `ok: true`。

