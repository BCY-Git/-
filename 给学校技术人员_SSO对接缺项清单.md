# 给学校技术人员：SSO 对接缺项清单

请协助提供或确认以下信息，用于接入学校统一认证。

## 1. 统一认证服务信息

- 统一认证服务根地址，例如：`https://auth.xxx.edu.cn`
- 授权接口地址，默认按：`/oauth2.0/authorize`
- token 接口地址，默认按：`/oauth2.0/accessToken`
- 用户信息接口地址，默认按：`/oauth2.0/profile`

## 2. 应用接入参数

- `client_id`：学校统一认证平台分配给本系统的应用编号，类似“应用账号”，用于识别当前接入的是哪个业务系统。
- `client_secret`：学校统一认证平台分配给本系统的应用密钥，类似“应用密码”，用于后端换取 `access_token`。该值只能配置在后端服务器，不能写入前端代码，不能对外公开。

## 3. 回调地址登记

请在学校统一认证后台登记本系统回调地址：

```text
https://本系统正式域名/api/v1/sso/callback
```

要求：协议、域名、端口、路径必须完全一致。

## 4. 学校后台菜单跳转地址

请将学校后台左侧菜单链接配置为：

```text
https://本系统正式域名/api/v1/sso/login
```

## 5. 用户信息返回样例

请提供用户信息接口实际返回 JSON，重点确认以下字段：

- `loginName`：登录账号
- `userUuid`：用户唯一标识
- `userName`：姓名
- `unitUuid`：单位 UUID
- `unitName`：单位名称
- `roleUuid`：角色 UUID
- `email`：邮箱
- `telephone`：电话

## 6. 管理员角色 UUID

如需统一认证用户登录后自动成为本系统管理员，请提供管理员对应的：

- `roleUuid`

不提供则默认按普通用户处理。

## 7. token / 用户信息接口传参方式

请确认：

- token 接口是否使用 `POST application/x-www-form-urlencoded`
- `client_secret` 是否放在 POST 表单体中
- 用户信息接口是否通过 `?access_token=xxx` 获取用户信息

## 8. 网络与 HTTPS

请确认：

- 本系统服务器可以访问学校统一认证服务
- 学校统一认证服务可以回调本系统地址
- 是否需要 IP 白名单、VPN、内网 DNS
- 正式环境是否强制 HTTPS
