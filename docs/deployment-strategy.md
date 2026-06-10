# 公网部署策略

## 目标

部署目标不是“能打开页面”这么简单，而是让评审可以在公网完整验证：

```txt
打开 URL -> 完成 funnel -> 看到 preview -> 调用 /pay -> 看到 full result
```

并且 README 提供可重放的 cURL、未支付 sessionId、已支付 sessionId、测试和 CI 状态。

## 最终部署组合

| 层 | 选择 | 说明 |
| --- | --- | --- |
| Web/API | Vercel | 部署 Next.js App Router 页面和 Route Handlers |
| Database | Supabase PostgreSQL | 符合题面 “Supabase / Prisma + PostgreSQL” 要求 |
| ORM/Migration | Prisma | schema、migration、类型安全和可审计变更 |
| CI | GitHub Actions | typecheck、test、build、E2E smoke |
| Demo Seed | Prisma seed script | 创建未支付和已支付测试 session |

Neon 技术上可行，但本项目主选 Supabase，原因是题面明确点名 Supabase，选择它能降低评审对技术要求合规性的疑问。

## 环境划分

| 环境 | 用途 | 数据库 |
| --- | --- | --- |
| Local dev | 本地开发和手动调试 | 本地 PostgreSQL 或 Supabase dev branch |
| CI | 自动测试 | GitHub Actions PostgreSQL service |
| Production demo | 评审公网演示 | Supabase PostgreSQL |

CI 不连接线上 Supabase，避免测试污染 demo 数据。

## 部署边界

本项目的公网部署只服务于挑战验收，不伪装成真实商业生产系统：

- 支付是 mock callback，主接口为 `POST /pay`，不接 Stripe、支付宝或真实扣费。
- 公网 demo 使用可复现的匿名 session，不要求评审注册登录。
- 线上 demo 数据只用于人工验收和 README cURL，不被自动化测试复用。
- CI 使用一次性 PostgreSQL service，不读取也不写入 Supabase production。
- 不提供公网 seed 接口；demo seed 只通过手动触发的 GitHub Actions production workflow 执行。

这个边界能把精力集中在题面真正评分的部分：API contract、数据库建模、状态恢复、权限裁剪、支付闭环和自动化测试。

## 环境变量

### Vercel production

```txt
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://healthgate-one.vercel.app
```

说明：

- `DATABASE_URL` 用 pooled connection，给运行时 API 使用。
- `DIRECT_URL` 在 Vercel build 中供 Prisma generate 读取；当前线上也配置为 pooled connection。
- `NEXT_PUBLIC_APP_URL` 用于 README/cURL 示例和跳转 URL 生成。

### GitHub Actions

常规 CI 使用 service PostgreSQL：

```txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthgate_test
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/healthgate_test
```

常规 CI 不需要 Supabase production secrets。

### GitHub Actions production environment

生产迁移和 demo seed 使用单独的 GitHub Environment：`production`。

建议配置 secrets：

```txt
PRODUCTION_DATABASE_URL=postgresql://...    # Supabase pooled/runtime connection
PRODUCTION_DIRECT_URL=postgresql://...      # Prisma env contract; current workflow does not use it for migration
PRODUCTION_APP_URL=https://healthgate-one.vercel.app
SUPABASE_ACCESS_TOKEN=...
SUPABASE_DB_PASSWORD=...
```

说明：

- `production` environment 建议开启 required reviewers，避免误触发。
- 这些 secrets 只给手动 production workflow 使用，不给普通 PR CI 使用。
- production migration 通过 Supabase CLI `db push --linked` 执行，使用 `SUPABASE_ACCESS_TOKEN` 和 `SUPABASE_DB_PASSWORD`。
- 不需要 Supabase service role key；后端只通过 Prisma 使用数据库连接串。
- 前端永远不暴露数据库连接串或 Supabase service role key。

## 发布顺序

推荐顺序是：

```txt
生成并提交 migration -> CI 通过 -> Supabase CLI production migrate -> Vercel deploy -> seed demo -> smoke 验收 -> 更新 README
```

关键判断：

- migration 文件必须随仓库提交，不能在 Vercel build 中临时生成。
- production migration 必须显式执行；本项目使用 Supabase CLI `db push --linked`，不在 Vercel build 中自动迁移。
- Vercel build 可以执行 `prisma generate && next build`，但不负责改变数据库结构。
- production migration 和 seed 由手动触发 workflow 执行，不绑定每次 push，也不绑定 Vercel build。
- 如果未来出现非兼容 schema 变更，先做向后兼容迁移，再发布代码，最后清理旧字段；本挑战第一版 migration 可以直接初始化。

## 部署流程

### 1. 准备 Supabase

1. 创建 Supabase project。
2. 获取 pooled connection string，配置为 `DATABASE_URL`。
3. 在 Vercel 设置 `DATABASE_URL`、`DIRECT_URL`、`NEXT_PUBLIC_APP_URL`。
4. 在 GitHub `production` environment 设置 Supabase token、数据库密码和 production DB URL。

### 2. 准备 Prisma migration

实现阶段需要生成并提交 migration：

```txt
npx prisma migrate dev --name init
```

提交内容：

```txt
prisma/schema.prisma
prisma/migrations/**
```

### 3. CI 验证

GitHub Actions 至少运行：

```txt
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
npm run test:e2e
```

如果 E2E 较慢，CI 至少跑一个 smoke E2E；README 说明完整 E2E 如何本地运行。

### 4. 生产维护 workflow

创建 `.github/workflows/production-maintenance.yml`，只允许手动触发：

```yaml
name: Production Maintenance

on:
  workflow_dispatch:
    inputs:
      operation:
        description: Operation to run
        required: true
        type: choice
        options:
          - migrate
          - seed-demo
          - migrate-and-seed
      confirm:
        description: Type healthgate-production to confirm
        required: true

jobs:
  production-maintenance:
    if: inputs.confirm == 'healthgate-production'
    runs-on: ubuntu-latest
    environment: production
    env:
      DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
      DIRECT_URL: ${{ secrets.PRODUCTION_DIRECT_URL }}
      NEXT_PUBLIC_APP_URL: ${{ secrets.PRODUCTION_APP_URL }}
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      SUPABASE_PROJECT_REF: lwqiuuymeqdkiwnebkey
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run prisma:generate
      - name: Link Supabase project
        if: inputs.operation == 'migrate' || inputs.operation == 'migrate-and-seed'
        run: npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD" --yes
      - name: Run production migrations
        if: inputs.operation == 'migrate' || inputs.operation == 'migrate-and-seed'
        run: npx supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --yes
      - name: Seed demo sessions
        if: inputs.operation == 'seed-demo' || inputs.operation == 'migrate-and-seed'
        run: npm run seed:demo
```

使用方式：

1. 首次上线或 schema 变更后，手动选择 `operation=migrate`。
2. Vercel production 部署完成后，手动选择 `operation=seed-demo`。
3. 如果是第一次部署且 Vercel 已经准备好，也可以选择 `migrate-and-seed`。

关键约束：

- 该 workflow 不监听 `push` 或 `pull_request`。
- 该 workflow 使用 GitHub `production` environment secrets。
- `confirm` 必须输入固定字符串，降低误触发概率。
- `seed:demo` 必须幂等，重复执行不能创建无限重复 demo 数据。

生产迁移实际执行的命令是：

```txt
npx supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --yes
```

不在 Vercel build 中隐式创建 migration。Vercel build 可以执行 `prisma generate`，但不负责 schema 变更。

### 5. 部署 Vercel

当前 production 使用 Vercel CLI 部署；如果后续要启用 push 自动部署，再在 Vercel 账号里补 GitHub login connection。

```txt
Build Command: npm run build
Output: Next.js default
Install Command: npm ci
```

`npm run build` 当前设计为：

```txt
prisma generate && next build
```

本次线上地址：

```txt
https://healthgate-one.vercel.app
```

### 6. Seed demo sessions

Vercel production 部署完成后，通过 `production-maintenance` workflow 执行：

```txt
operation=seed-demo
```

seed 应创建：

| demo | 状态 | 用途 |
| --- | --- | --- |
| unpaid demo session | completed + result + no active subscription | 评审直接看 preview |
| paid demo session | completed + result + active subscription | 评审直接看 full |

README 最终写入：

```txt
UNPAID_DEMO_SESSION_ID=<uuid>
PAID_DEMO_SESSION_ID=<uuid>
```

注意：

- demo seed 必须幂等，可重复执行。
- demo payment 使用固定 idempotencyKey。
- 不要让自动测试复用 production demo session。
- workflow 日志应打印两个 demo sessionId，方便复制到 README。

## 评审可重放流程

README 最终必须提供：

```bash
BASE_URL="https://healthgate-one.vercel.app"

curl -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{"flowTopic":"healthgate_weight_management_v1","resumeExisting":false}'

# Copy sessionId from the response into SESSION_ID.
SESSION_ID="<created-session-id>"

curl -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/steps/profile" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":1,"answers":{"gender":"female","ageRange":"30_39","currentBodyShape":"mid_sized"}}'

curl -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/steps/goal" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":2,"answers":{"goalType":"lose_weight","bodyZones":["belly","legs"],"desiredBodyShape":"toned"}}'

curl -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/steps/body" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":3,"answers":{"age":32,"heightCm":168,"currentWeightKg":74,"targetWeightKg":65,"healthDataConsent":true}}'

curl -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/steps/activity" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":4,"answers":{"activityLevel":"moderate","exerciseFrequency":"3_4_week","typicalDay":"active_breaks"}}'

curl -X PATCH "$BASE_URL/api/sessions/$SESSION_ID/steps/habits" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":5,"answers":{"sleepHours":"7_8","waterIntake":"medium","dietPreference":"traditional","physicalLimitations":[]}}'

curl -X POST "$BASE_URL/api/sessions/$SESSION_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"expectedVersion":6}'

curl "$BASE_URL/api/sessions/$SESSION_ID/result"

curl -X POST "$BASE_URL/pay" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'$SESSION_ID'","idempotencyKey":"review-demo-001","status":"succeeded"}'

curl "$BASE_URL/api/sessions/$SESSION_ID/result"
```

评审应能看到：

- 第一次 result：`access=preview`，无 protected fields。
- `/pay` 后 result：`access=full`，包含 protected fields。

protected fields 至少包括：

```txt
bmr
tdee
recommendedCalories
goalDirection
weeklyDeltaKg
targetDate
caloriePlan
projectionCurve
```

preview 响应里不仅不能返回这些字段的值，也不应该返回这些字段名。

## 上线 smoke runbook

每次部署后按顺序执行：

1. `GET /api/health` 返回 `ok=true`。
2. 打开公网首页，完成一次全新 funnel。
3. 中途刷新一次，确认 answers 恢复。
4. submit 后进入 `/result?sessionId=...`。
5. 未支付状态检查 result API：`access=preview`，无 protected fields。
6. 用 README 的 `POST /pay` cURL 支付同一 session。
7. 再次请求 result API：`access=full`，包含完整结果。
8. 打开已支付 demo session，确认可直接对比 full。
9. 检查 GitHub Actions 最新 run 通过。

smoke 验收通过后，才能把 public URL、demo sessionId 和 CI badge 写入最终 README。

## 健康检查

提供：

```txt
GET /api/health
```

返回：

```json
{
  "ok": true,
  "service": "healthgate",
  "timestamp": "..."
}
```

用途：

- 验证 Vercel API 可达。
- 排查环境变量/数据库连接问题。
- 部署后 smoke check。

## GitHub Actions

建议 workflow：

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: healthgate_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run prisma:generate
      - run: npx prisma migrate deploy
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run test:e2e
```

实现阶段如果选择 E2E smoke：

```txt
npm run test:e2e -- --grep @smoke
```

README 必须说明完整 E2E 运行方式。

## 部署验收清单

上线后逐项验证：

| 验收项 | 验证方式 |
| --- | --- |
| 公网 URL 可打开 | 浏览器打开 Vercel URL |
| Funnel 可完成 | 从第 1 步走到结果页 |
| 刷新可恢复 | 中途刷新，答案仍在 |
| 未支付结果为 preview | 页面和 API 都不含 protected fields |
| `/pay` 可重放 | README cURL 成功 |
| 支付后结果为 full | 同一 session 返回 full |
| Demo session 可用 | README 中两个 sessionId 可访问 |
| CI 通过 | GitHub Actions 最新 run 通过 |
| `/api/health` 正常 | 返回 `ok=true` |

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| Supabase 连接数过多 | Runtime 用 pooled connection，生产迁移走 Supabase CLI |
| Migration 未执行 | README 写明 production workflow，CI/build 检查 Prisma generate |
| 评审无法复现支付 | README 提供 `/pay` cURL 和 demo sessionId |
| Demo 数据被测试污染 | CI 使用独立 PostgreSQL service，不连 production |
| production workflow 被误触发 | 仅 `workflow_dispatch` + `production` environment approval + confirm 输入 |
| production secrets 泄漏 | 只放在 GitHub Environment secrets，不写入 `.env.example` 或 README |
| Serverless 冷启动 | API 保持轻量，算法本地纯计算 |
| Cookie 跨浏览器不可用 | URL 和 cURL 均支持显式 `sessionId` |
| 线上错误难排查 | 统一错误结构 + `/api/health` |

## 当前状态

- 部署策略：已设计并按当前方案执行。
- Vercel 项目：已创建并发布到 https://healthgate-one.vercel.app。
- Supabase project：已创建并完成 migration。
- Migration：已生成并同步到 `supabase/migrations/20260610000000_init.sql`。
- Demo seed：已执行，README 已写入未支付/已支付 demo sessionId。
- CI workflow：已通过，run 为 https://github.com/77652189/healthGate/actions/runs/27260027467。
- Production maintenance workflow：已切换为 Supabase CLI migration。
- Public URL：已写入 README。
- 上线 smoke：已通过 `/api/health`、demo preview/full、全新 session `/pay` 闭环验证。
