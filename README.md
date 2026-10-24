# 工作账本 · Supabase 云端版 v0.3

手机 React + TypeScript 应用，Sites 网址沿用 v0.2。Supabase 项目 work-ledger（ap-northeast-2），项目 ID lulxfmocuhaspyjzwvdl。

## 使用

进入网页后，用邮箱和密码注册；验证邮件后回到网页登录。网页访问的 ChatGPT 登录和账本邮箱登录是独立步骤。首次正式登录为空账本，先添加老板再记工作。历史模拟记录保留在原浏览器，账号与备份中可导出旧版记录；核对后再导入，避免把模拟记录当作正式数据。

每次操作经服务器保存成功才更新界面；失败明确提示，不会显示为保存成功。重新聚焦网页会刷新账本，也可以手动刷新。另一设备更新后，旧版本写入会被拒绝，需刷新后重试。本版不支持离线修改。

## 数据与安全

老板、工作、工资、垫付、收款、分配独立存储在六张表中，账本版本另存。各表 RLS 按 auth.uid() 隔离。前端只用 publishable key。事务保存及读取使用 SECURITY INVOKER RPC，工资计算、日期、归属、分配总额及超额收款在数据库验证。快照替换在一笔事务内完成并用 revision 乐观锁避免设备间覆盖；适合个人小账本，不设计为大型多人系统。导入最高 5MB。

账号与备份支持 JSON 导出、预览恢复和显式替换确认。备份包含完整账目，请自行妥善保管。

## 开发与验证

npm ci
npm run check
npm test
npm run build

数据库结构在 database/schema.sql；数据库事务回滚测试在 database/test.sql。database/integration.mjs 供临时测试账号执行真实 API 验证，stdin 接收测试密码，勿使用真实用户账号。

邮箱注册使用 Supabase 默认邮件服务，邮件验证后若重定向失败，直接返回原网址登录。正式大范围使用前应配置生产邮件服务和 Auth URL 白名单。未替用户注册真实账号或发送验证邮件。

## GitHub Pages 发布

使用公开仓库 work-ledger，main 分支。仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。每次推送 main 会自动检查、构建并发布 dist。实际访问地址以成功的 Pages deployment 为准。

Supabase Auth → URL Configuration 需将 Site URL 与 Redirect URLs 设为成功发布的 Pages 地址（包括 /work-ledger/ 路径），以便验证邮件返回本站。前端仅含公开 publishable key，没有 service_role 或数据库密码。账目继续保存在原独立 Supabase 项目；GitHub 仅托管网页。

首次到新网址需重新登录同一账本账号；原浏览器 localStorage 属于旧网址，未上传的原型记录需先导出再迁移。
