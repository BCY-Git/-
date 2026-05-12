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

## 部署

部署说明见：

```text
部署说明.md
```

一键部署入口：

```bash
sudo bash deploy/deploy.sh
```
