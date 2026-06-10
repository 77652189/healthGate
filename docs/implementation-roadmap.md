# 实现路线图

## 原则

实现阶段遵循：

- 先后端核心，再前端体验。
- 先纯函数和测试，再接数据库和 HTTP。
- 每阶段都有可验证产物。
- 不做题面之外的大功能。

核心闭环：

```txt
Schema -> Domain -> Repository -> API -> Tests -> UI -> CI -> Deploy -> README
```

这不是严格瀑布。原则是：契约和测试先稳定，UI 可以在 API contract 明确后并行推进；但任何面向评审的“已完成”声明，都必须等对应测试或 smoke 验证通过。

## 不可跳过的阶段门控

| 门控 | 通过条件 | 不能提前做什么 |
| --- | --- | --- |
| Schema gate | `prisma validate` 通过，migration 可生成 | 不写依赖未定字段的 repository |
| Domain gate | 算法、validation、access cropper 单元测试通过 | 不把算法写进 route handler |
| Service gate | save/restore/submit/pay 集成测试通过 | 不开始宣称后端闭环完成 |
| API gate | cURL 可走完整 preview -> `/pay` -> full | 不让前端用 mock 数据冒充完成 |
| UI gate | 浏览器可刷新恢复并走到 full result | 不进入部署收口 |
| CI gate | GitHub Actions 通过 | 不把 README 写成最终交付版 |
| Deploy gate | 公网 smoke runbook 通过 | 不发送交付邮件 |

## 阶段 0：整理项目基础

目标：

- 统一实际工作目录。
- 补齐脚本、依赖和目录结构。
- 避免继续在错误目录写代码。

任务：

1. 确认最终 repo root：

```txt
C:\Users\63097\Documents\CursorProject\healthGate
```

2. 确认 GitHub repo：

```txt
https://github.com/77652189/healthGate
```

3. 补齐 scripts：

```txt
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:ci
npm run seed:demo
```

4. 安装实现所需依赖：

```txt
@playwright/test
```

5. 整理模块目录：

```txt
src/modules/**
src/shared/**
tests/**
app/**
```

验证：

```txt
npm run typecheck
npx prisma validate
```

阶段 0 完成后，项目应该具备一个清晰事实：所有后续实现都发生在 `C:\Users\63097\Documents\CursorProject\healthGate`，而不是空的 `C:\Users\63097\Documents\HealthGate`。

不做：

- 不先做复杂 UI。
- 不接真实支付。

## 阶段 1：Prisma schema 与 migration

目标：

- 将数据库设计落成 migration。
- 保证 Prisma Client 可生成。

任务：

1. 确认 `prisma/schema.prisma` 与 [数据库设计](./database-design.md) 一致。
2. 生成 migration：

```txt
npx prisma migrate dev --name init
```

3. 生成 client：

```txt
npm run prisma:generate
```

4. 准备测试数据库 helper。

验证：

```txt
npx prisma validate
npm run prisma:generate
```

产物：

```txt
prisma/migrations/**
tests/helpers/db.ts
```

不做：

- 不手动修改 production database。
- 不在 Vercel build 隐式创建 migration。

## 阶段 2：Domain types、validation、algorithm

目标：

- 先把核心业务逻辑写成纯函数。
- 为后续 API 和测试提供稳定类型。

任务：

1. 定义 domain types。
2. 实现 Zod schemas：
   - step payload validation
   - assessment input validation
   - payment payload validation
3. 实现健康评估算法：
   - BMI
   - BMI category
   - BMR
   - TDEE
   - recommended calories
   - targetDate
   - projectionCurve
4. 实现 result access cropper：
   - preview
   - full
   - protected fields recursive check helper

验证：

```txt
npm run test:unit
```

产物：

```txt
src/modules/assessment/**
src/modules/access/**
src/modules/quiz/schemas.ts
src/modules/payment/schemas.ts
```

不做：

- 不在 route handler 里写算法。
- 不让前端决定权限裁剪。

## 阶段 3：Repository 与 service

目标：

- 用模块化单体实现核心业务流程。
- service 负责编排，repository 负责 Prisma。

任务：

1. `quiz`：
   - create-or-resume session
   - restore session
   - save step
   - version conflict
   - completedSteps/currentStep 计算
   - core field modified -> result stale
2. `assessment`：
   - submit 完整性校验
   - result 生成
   - result 幂等：同 session version 返回同 result
   - result stale/current transaction
3. `payment`：
   - `/pay` mock event
   - idempotency
   - subscription upsert
4. `access`：
   - result lookup
   - subscriptionStatus 计算
   - preview/full response

验证：

```txt
npm run test:integration
```

产物：

```txt
src/modules/quiz/service.ts
src/modules/quiz/repository.ts
src/modules/assessment/service.ts
src/modules/assessment/repository.ts
src/modules/payment/service.ts
src/modules/payment/repository.ts
src/modules/access/service.ts
```

不做：

- 不把 Prisma 查询散落在 route handler。
- 不把 payment 逻辑写进 quiz 模块。

## 阶段 4：API routes

目标：

- 按 [API 设计](./api-design.md) 提供 HTTP contract。

任务：

实现：

```txt
POST /api/sessions
GET /api/sessions/:sessionId
PATCH /api/sessions/:sessionId/steps/:stepKey
POST /api/sessions/:sessionId/submit
GET /api/sessions/:sessionId/result
POST /pay
GET /api/health
```

要求：

- Zod validation。
- 统一错误结构。
- HttpOnly cookie `hg_session_id`。
- path/body sessionId 优先于 cookie。
- `POST /pay` 是主支付接口。

验证：

```txt
npm run test:integration
curl http://localhost:3000/api/health
```

不做：

- 不只实现 happy path。
- 不让 `/api/pay` 成为主交付路径。

## 阶段 5：自动化测试补齐

目标：

- 满足题面第四阶段测试要求。
- 把前面阶段中已经写过的 unit/integration tests 补成题面可追踪矩阵，而不是最后临时补 happy path。

任务：

按 [测试要求可追踪矩阵](./test-requirements-traceability.md) 实现：

1. Algorithm unit tests。
2. Validation boundary tests。
3. Access cropper tests。
4. Session integration tests。
5. Submit/result integration tests。
6. Payment integration tests。
7. API error contract tests。

验证：

```txt
npm test
npm run test:ci
```

不做：

- 不追求无意义 100% 覆盖。
- 不让集成测试连接 production Supabase。

## 阶段 6：前端 funnel 与结果页

目标：

- 让真实用户愿意一路走到 paywall。
- 不复杂炫技，但完整、可信、可演示。

任务：

1. 单页 8 步 funnel。
2. create-or-resume session。
3. 每步 PATCH 保存。
4. refresh restore。
5. submit 后跳转 result。
6. preview result。
7. pay CTA。
8. full result。
9. 修改答案入口。
10. result not ready/error/loading 状态。

验证：

```txt
npm run dev
npm run test:e2e
```

不做：

- 不做传统营销 landing page。
- 不前端假造 protected result。
- 不用前端遮罩冒充鉴权。

并行策略：

- 前端可以在 API contract 稳定后先实现静态流程和表单状态。
- 真正的结果页和支付状态必须接真实 API。
- 如果后端还没完成，前端只能使用本地 fixture 做布局验证，不能把 fixture 当成验收证据。

## 阶段 7：Playwright E2E

目标：

- 证明线上用户路径真的跑通。

任务：

1. 完整 funnel -> preview -> pay -> full。
2. 中断恢复。
3. completed session 再打开首页自动跳 result。

验证：

```txt
npm run test:e2e
```

不做：

- 不把所有非法输入都搬到 E2E。
- 不做像素级视觉测试。

## 阶段 8：CI

目标：

- GitHub Actions 自动跑测试和构建。

任务：

1. 创建 `.github/workflows/ci.yml`。
2. 配置 PostgreSQL service。
3. 跑：

```txt
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
npm run test:e2e
```

验证：

- GitHub Actions 最新一次通过。
- README 加 CI badge。

不做：

- CI 不连接 production Supabase。
- 常规 CI 不持有 production database secrets。

## 阶段 9：部署与 demo seed

目标：

- 提供公网可达、可完整演示的线上链接。

任务：

1. 创建 Supabase project。
2. 配置 Vercel env vars。
3. 配置 GitHub `production` environment secrets。
4. 创建手动触发的 `production-maintenance` workflow。
5. 通过 workflow 执行 production migration。
6. 部署 Vercel。
7. 通过 workflow 执行 `seed-demo`。
8. 记录：
   - public URL
   - unpaid demo sessionId
   - paid demo sessionId

验证：

```txt
GET /api/health
完整 funnel 手动走通
README /pay cURL 重放
```

不做：

- 不接真实支付。
- 不把 demo seed 当测试数据复用。
- 不在 Vercel build 中自动执行 migration 或 seed。

## 阶段 10：README 与交付文档收口

目标：

- 让评审不用问你就能跑通和验证。

任务：

1. 按 [README 交付结构](./readme-delivery-structure.md) 重写 README。
2. 填入 public URL。
3. 填入 GitHub repo。
4. 填入 demo sessionId。
5. 填入 `/pay` cURL。
6. 填入测试覆盖范围。
7. 填入暂不覆盖内容。
8. 填入 CI badge。
9. 更新 [AI 协作复盘](./ai-collaboration-review.md) 的实现阶段内容。

验证：

- 从 README 复制命令可运行。
- 从 README cURL 可复现 preview -> full。
- 文档链接无缺失。

## 推荐实施顺序

```txt
0. 项目基础
1. Prisma schema + migration
2. Domain + unit tests
3. Repository/service + integration tests
4. API routes
5. Frontend funnel/result
6. E2E
7. CI
8. Deploy + seed
9. README + AI recap
```

## 三天冲刺安排

| 时间 | 目标 | 必须产出 |
| --- | --- | --- |
| 第 1 天 | 后端骨架和数据流跑通 | migration、domain tests、session save/restore、submit/result 初版 |
| 第 2 天 | 权限闭环和测试加固 | access cropper、`/pay`、integration tests、API cURL 闭环 |
| 第 3 天 | 前端演示、E2E、CI、部署和文档收口 | funnel/result UI、Playwright、GitHub Actions、Vercel/Supabase、README/AI 复盘 |

如果时间压力很大，优先级如下：

1. 后端 API 和数据库闭环。
2. 题面明确要求的测试覆盖。
3. 可演示的最小前端体验。
4. CI 和公网部署。
5. README 与 AI 复盘最终收口。

不能牺牲的是：非会员不得拿到 protected fields，`/pay` 后同一 session 必须从 preview 变 full，自动化测试不能只测 happy path。

## 每阶段完成定义

| 阶段 | 完成定义 |
| --- | --- |
| Schema | `npx prisma validate` 通过，migration 已提交 |
| Domain | algorithm/access/validation unit tests 通过 |
| Service | integration tests 覆盖 save/restore/submit/pay |
| API | cURL 能走完整流程 |
| Frontend | 浏览器能从第 1 步走到 full result |
| E2E | Playwright 关键路径通过 |
| CI | GitHub Actions 最新通过 |
| Deploy | 公网 URL 可完整演示 |
| README | 评审可按 README 独立复现 |

## 当前状态

- 阶段 0：已完成，scripts、依赖和目录结构已补齐。
- 阶段 1：已完成，Prisma migration 已生成并通过临时 PostgreSQL 验证。
- 阶段 2：已完成，algorithm、validation、access cropper 单元测试通过。
- 阶段 3：已完成，quiz/payment/assessment 集成测试通过。
- 阶段 4：已完成，API routes 已实现。
- 阶段 5：已完成，自动化测试矩阵已落地。
- 阶段 6：已完成，前端 funnel/result 已接真实 API。
- 阶段 7：已完成，Playwright E2E 通过。
- 阶段 8：已完成，CI workflow 和 production-maintenance workflow 已加入仓库。
- 阶段 9：已完成，Supabase/Vercel 已创建，production migration 和 demo seed 已执行。
- 阶段 10：已完成，README 已回填公网 URL、CI run、未支付/已支付 demo sessionId，并完成线上 smoke 验收。

## 下一步开工清单

进入代码实现时，第一批任务按这个顺序执行：

1. 补 `package.json` scripts 和 `@playwright/test`。
2. 生成 Prisma migration。
3. 建立 `src/modules`、`src/shared`、`tests/helpers`、`app` 目录骨架。
4. 先写 algorithm/validation/access cropper 单元测试。
5. 实现 domain 纯函数直到 unit tests 通过。
6. 再写 quiz/payment/assessment service 集成测试。
7. 接 Prisma repository 和 service 事务。
8. 最后接 API routes。

这批任务完成后，应当可以用 cURL 跑通后端闭环，再进入前端实现。
