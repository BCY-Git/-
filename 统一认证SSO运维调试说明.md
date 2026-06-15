# 统一认证 SSO 运维调试说明

本文档用于现场运维人员理解和调试统一认证登录流程。核心代码位于：

```text
backend/src/sso/sso.service.ts
```

统一认证流程可以理解为：

```text
生成学校登录地址
→ 学校认证成功后回调 code
→ code 换 access_token
→ access_token 获取学校用户信息
→ 转成本系统用户
→ 生成一次性 ticket
→ 前端用 ticket 换取本系统 JWT 并进入系统
```

## 一、环境变量配置

统一认证依赖以下环境变量：

```env
SSO_BASE_URL=学校统一认证地址
SSO_CLIENT_ID=学校分配的客户端ID
SSO_CLIENT_SECRET=学校分配的客户端密钥
SSO_REDIRECT_URI=http://你的后端地址/api/v1/sso/callback
SSO_FRONTEND_CALLBACK_URL=http://你的前端地址/sso/callback
SSO_ADMIN_ROLE_UUIDS=管理员角色UUID,多个用英文逗号分隔
```

字段说明：

| 配置项 | 是否必填 | 说明 |
| --- | --- | --- |
| `SSO_BASE_URL` | 是 | 学校统一认证服务器根地址，例如 `https://auth.xxx.edu.cn` |
| `SSO_CLIENT_ID` | 是 | 学校分配给本系统的客户端 ID |
| `SSO_CLIENT_SECRET` | 是 | 学校分配给本系统的客户端密钥，只能放后端 |
| `SSO_REDIRECT_URI` | 是 | 学校认证成功后回调到本系统后端的地址 |
| `SSO_FRONTEND_CALLBACK_URL` | 是 | 后端处理完登录后跳回前端的地址 |
| `SSO_ADMIN_ROLE_UUIDS` | 否 | 哪些学校角色 UUID 映射成本系统管理员 |

注意：

- `SSO_REDIRECT_URI` 必须和学校统一认证后台登记的回调地址完全一致。
- 正式环境不要继续使用 `localhost`，要换成服务器 IP 或域名。
- `SSO_CLIENT_SECRET` 不允许写到前端代码里。

## 二、`buildAuthorizeUrl()`

位置：

```text
backend/src/sso/sso.service.ts
```

作用：生成学校统一认证登录地址。

生成的地址类似：

```text
{SSO_BASE_URL}/oauth2.0/authorize
  ?response_type=code
  &client_id=xxx
  &redirect_uri=http://后端/api/v1/sso/callback
  &state=xxx
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `response_type=code` | 使用 OAuth2 授权码模式 |
| `client_id` | 学校分配的客户端 ID |
| `redirect_uri` | 学校认证成功后回调本系统后端 |
| `state` | 防止伪造回调的临时校验值，有效期 10 分钟 |

现场调试：

```bash
curl -I http://localhost:8000/api/v1/sso/login
```

正常情况应返回 `302`，并跳转到学校统一认证地址。

如果提示：

```text
统一认证未配置完整
```

说明 `.env` 里的 SSO 配置没填全。

## 三、`completeLogin(code, state)`

作用：处理学校认证后的回调，是整个 SSO 登录的主流程。

输入参数：

| 参数 | 说明 |
| --- | --- |
| `code` | 学校认证成功后返回的授权码 |
| `state` | 登录前生成的校验值 |

执行流程：

```text
1. 检查 code 是否存在
2. 校验 state
3. 用 code 换 access_token
4. 用 access_token 获取学校用户信息
5. 把学校用户同步成本地 User
6. 签发本系统 JWT
7. 生成前端回调地址
```

返回结果：

```ts
{
  access_token: '本系统JWT',
  token_type: 'bearer',
  user: '本系统用户信息',
  redirect_url: '前端/sso/callback#ticket=xxx'
}
```

常见问题：

| 现象 | 可能原因 |
| --- | --- |
| 缺少统一认证授权码 | 学校没有正确回调，或回调地址错误 |
| state 校验失败 | 登录超时、回调丢失 state、后端 JWT_SECRET 改变 |
| 换取 token 失败 | `client_id`、`client_secret`、`redirect_uri` 或 `code` 有问题 |
| 获取用户信息失败 | `access_token` 无效，或学校 profile 接口异常 |

## 四、`getConfig()`

作用：读取环境变量并检查必填项。

必填配置：

```text
SSO_BASE_URL
SSO_CLIENT_ID
SSO_CLIENT_SECRET
SSO_REDIRECT_URI
```

可选配置：

```text
SSO_FRONTEND_CALLBACK_URL
SSO_ADMIN_ROLE_UUIDS
```

如果 `SSO_FRONTEND_CALLBACK_URL` 没配置，默认值是：

```text
http://localhost:8100/sso/callback
```

正式部署时必须改成真实前端地址。

## 五、`exchangeCode(config, code)`

作用：拿学校回调的 `code` 换取 `access_token`。

请求地址：

```text
{SSO_BASE_URL}/oauth2.0/accessToken
```

请求方式：

```text
POST
```

请求参数：

| 参数 | 说明 |
| --- | --- |
| `grant_type=authorization_code` | 固定值，表示授权码模式 |
| `client_id` | 学校分配的客户端 ID |
| `client_secret` | 学校分配的客户端密钥 |
| `code` | 学校回调返回的授权码 |
| `redirect_uri` | 本系统后端回调地址 |

学校正常应返回：

```json
{
  "access_token": "xxx",
  "token_type": "bearer",
  "expires_in": 28800
}
```

如果提示：

```text
统一认证未返回 access_token
```

说明学校接口有返回，但返回内容里没有 `access_token`。需要让学校现场人员确认接口返回格式。

## 六、`fetchProfile(config, accessToken)`

作用：用 `access_token` 获取当前登录用户信息。

请求地址：

```text
{SSO_BASE_URL}/oauth2.0/profile?access_token=xxx
```

按文档，学校返回类似：

```json
{
  "id": "user1",
  "client_id": "xxx-system",
  "attributes": {
    "loginName": "zhangsan",
    "userUuid": "uuid",
    "userName": "张三",
    "unitUuid": "单位uuid",
    "unitName": "单位名称",
    "roleUuid": "角色id",
    "email": "邮箱",
    "telephone": "电话"
  }
}
```

本系统主要使用：

| 字段 | 用途 |
| --- | --- |
| `loginName` | 本地用户名 |
| `userUuid` | 统一认证用户唯一标识 |
| `userName` | 页面显示姓名 |
| `unitUuid` | 单位 UUID |
| `unitName` | 单位名称 |
| `roleUuid` | 判断是否管理员 |
| `email` | 邮箱 |
| `telephone` | 联系电话 |

## 七、`fetchJson(url, init, fallbackMessage)`

作用：统一发送 HTTP 请求，并解析 JSON 响应。

参数说明：

| 参数 | 说明 |
| --- | --- |
| `url` | 请求地址 |
| `init` | 请求配置，例如 `{ method: 'POST' }` |
| `fallbackMessage` | 默认错误提示 |

执行逻辑：

```text
1. 调用 fetch 请求学校接口
2. 读取响应文本
3. 尝试解析 JSON
4. 如果 HTTP 状态不是 2xx，抛出错误
```

调试说明：

- 如果学校返回 JSON 错误，例如 `{ "message": "xxx" }`，系统会优先显示学校返回的错误。
- 如果学校返回 HTML 错误页，系统不会因为 JSON 解析失败而崩溃，会显示默认错误提示。

## 八、`toSyncInput(profile, config)`

作用：把学校返回的用户字段转换成本系统用户同步格式。

字段映射：

| 学校字段 | 本系统字段 |
| --- | --- |
| `attributes.loginName` | `username` |
| `attributes.userUuid` | `ssoUserUuid` |
| `attributes.userName` | `displayName` |
| `attributes.email` | `email` |
| `attributes.telephone` | `ssoTelephone` |
| `attributes.unitUuid` | `ssoUnitUuid` |
| `attributes.unitName` | `ssoUnitName` |
| `attributes.roleUuid` | 用于判断 `admin/user` |

如果学校没有返回 `loginName` 或 `userUuid`，代码会退而使用 `profile.id`。

如果最终仍没有用户标识，会提示：

```text
统一认证用户信息缺少 loginName 或 userUuid
```

这个错误说明学校 profile 返回字段不符合当前文档，需要现场抓取接口返回内容确认。

## 九、`mapRole(roleUuid, adminRoleUuids)`

作用：把学校角色映射成本系统角色。

规则：

```text
如果 roleUuid 在 SSO_ADMIN_ROLE_UUIDS 里 -> admin
否则 -> user
```

示例配置：

```env
SSO_ADMIN_ROLE_UUIDS=role-admin-001,role-admin-002
```

如果学校返回：

```json
"roleUuid": "role-admin-001"
```

该用户进入本系统后角色就是 `admin`。

注意：

- 统一认证不会自动生成 `super_admin`。
- `super_admin` 仍然由本地账号控制，避免学校角色误配导致最高权限外放。

## 十、`verifyState(state)`

作用：校验回调是否来自本系统发起的那次登录。

`state` 由 `buildAuthorizeUrl()` 生成，有效期 10 分钟。

常见失败原因：

| 原因 | 说明 |
| --- | --- |
| 用户打开登录页太久 | `state` 超过 10 分钟过期 |
| 学校回调丢失 state | 回调参数不完整 |
| 有人伪造回调 | 安全校验失败 |
| 后端更换了 `JWT_SECRET` | 旧 state 无法被新密钥验证 |

## 十一、`buildFrontendCallbackUrl(frontendCallbackUrl, ticket)`

作用：生成最终跳回前端的地址。

结果类似：

```text
http://localhost:8100/sso/callback#ticket=一次性ticket
```

这里使用 `#ticket=`，不是 `?ticket=`，原因是：

- `#` 后面的内容不会发送给服务器。
- ticket 不容易进入后端访问日志。
- URL 中不直接暴露 JWT，前端需要再调用 `/api/v1/sso/ticket` 换取登录态。

前端页面：

```text
frontend/src/views/SsoCallback.vue
```

负责读取 `#ticket=`，向后端换取 JWT，写入本地登录态并跳转系统首页。

## 十二、`toSet(value)`

作用：把英文逗号分隔的字符串转换成集合。

示例：

```env
SSO_ADMIN_ROLE_UUIDS=a,b,c
```

会转换为：

```ts
Set(['a', 'b', 'c'])
```

用途是快速判断学校返回的 `roleUuid` 是否属于管理员角色。

## 现场调试顺序

### 1. 检查后端是否启动

```bash
curl http://localhost:8000/api/v1/health
```

正常返回：

```json
{"status":"ok"}
```

### 2. 检查 SSO 配置

```bash
cat backend/.env
```

重点检查：

```env
SSO_BASE_URL
SSO_CLIENT_ID
SSO_CLIENT_SECRET
SSO_REDIRECT_URI
SSO_FRONTEND_CALLBACK_URL
```

### 3. 测试 SSO 登录入口

```bash
curl -I http://localhost:8000/api/v1/sso/login
```

正常应返回 `302`，并跳转学校统一认证地址。

### 4. 查看后端日志

本地开发环境：

```bash
npm run dev
```

部署环境：

```bash
journalctl -u lingxuan-nest-backend -f
```

### 5. 如果能回调但进不了系统

重点确认学校 profile 返回里是否有：

```text
loginName
userUuid
userName
roleUuid
unitUuid
unitName
```

### 6. 如果登录成功但权限不对

检查：

```env
SSO_ADMIN_ROLE_UUIDS
```

学校返回的 `roleUuid` 必须和这里完全一致，才会映射成 `admin`。

## 常见配置示例

本地调试：

```env
SSO_BASE_URL=https://auth.xxx.edu.cn
SSO_CLIENT_ID=xxx-system
SSO_CLIENT_SECRET=xxxxxxxx
SSO_REDIRECT_URI=http://localhost:8000/api/v1/sso/callback
SSO_FRONTEND_CALLBACK_URL=http://localhost:8100/sso/callback
SSO_ADMIN_ROLE_UUIDS=
```

正式部署：

```env
SSO_BASE_URL=https://auth.xxx.edu.cn
SSO_CLIENT_ID=xxx-system
SSO_CLIENT_SECRET=xxxxxxxx
SSO_REDIRECT_URI=http://服务器IP或域名/api/v1/sso/callback
SSO_FRONTEND_CALLBACK_URL=http://服务器IP或域名/sso/callback
SSO_ADMIN_ROLE_UUIDS=学校管理员角色UUID
```
