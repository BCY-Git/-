# 供应商轮候抽取系统 NestJS 版

这是供应商轮候抽取系统的 NestJS 维护分支，包含：

- 后端：NestJS + Prisma + SQLite，目录 `backend`
- 前端：Vue 3 + Vite + Element Plus，目录 `frontend`
- 部署辅助：`deploy`

## 初始账号

系统初始化时只创建超级管理员 `admin`。初始密码来自 `backend/.env` 中的 `INIT_ADMIN_PASSWORD`，正式部署时由部署脚本随机生成并写入 `/etc/lingxuan-nest/backend.env`。

## 本地启动

后端：

```bash
cd backend
npm install
cp .env.example .env
npm run db:init
npm run dev
```

前端：

```bash
cd frontend
npm install
npm run dev
```

浏览器访问：

```text
http://127.0.0.1:5173
```

前端开发服务会把 `/api` 代理到 `http://127.0.0.1:8000`。

## 打包

```bash
bash deploy/package.sh
```

压缩包会生成到 `release/`，并排除 `node_modules`、构建产物、本地数据库、上传文件等运行数据。

## 统一认证预留

系统已预留学校统一认证 OAuth2/OIDC 接入入口，默认关闭，不影响本地账号密码登录。现场拿到学校认证资料后，在后端环境变量中配置并启用：

- `SSO_ENABLED=true`
- `SSO_AUTHORIZATION_URL`
- `SSO_TOKEN_URL`
- `SSO_USERINFO_URL`
- `SSO_CLIENT_ID`
- `SSO_CLIENT_SECRET`
- `SSO_REDIRECT_URI`
- `SSO_FRONTEND_CALLBACK_URL`

后端入口为 `/api/v1/auth/sso/start`，回调入口为 `/api/v1/auth/sso/callback`。登录页会在后端返回 SSO 已启用时显示“统一认证登录”按钮。

## 部署

部署说明见：

```text
部署说明.md
```

一键部署入口：

```bash
sudo bash deploy/deploy.sh
```
