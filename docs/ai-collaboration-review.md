# AI 协作复盘

## 复盘定位

这份文档用于交付题面要求的 AI 使用复盘。它不是泛泛而谈“我用了 AI 写代码”，而是说明 AI 在 HealthGate 中具体参与了哪些工程决策、哪些边界测试、哪些方案被否决，以及为什么。

当前状态：

- 设计阶段复盘：已完成。
- 实现阶段复盘：核心代码、测试、CI workflow、Supabase/Vercel 部署、public URL 和 demo sessionId 均已补充。

## 证据链

这份复盘与项目文档之间的对应关系如下，避免 AI 使用说明变成空泛表述：

| AI 参与内容 | 项目证据 |
| --- | --- |
| 竞品数据流调研 | `docs/competitor-research.md` |
| 架构拆分与模块边界 | `docs/architecture.md` |
| API contract 与异常路径 | `docs/api-design.md` |
| 数据库建模与约束 | `docs/database-design.md`、`prisma/schema.prisma` |
| 前端 funnel 取舍 | `docs/frontend-funnel-design.md` |
| 自动化测试矩阵 | `docs/testing-strategy.md`、`docs/test-requirements-traceability.md` |
| 部署和交付策略 | `docs/deployment-strategy.md`、`docs/readme-delivery-structure.md` |
| 实现优先级 | `docs/implementation-roadmap.md` |

面试时可以按这条线解释：AI 不是只生成代码，而是先帮助收集线索和提出方案，再由我根据题面约束、风险和可验证性做取舍。

## AI 参与的阶段

### 1. 竞品调研与数据流抽象

AI 协助做的工作：

- 梳理 BetterMe quiz funnel 的页面流程。
- 提取 `order=<uuid>` 这种匿名 questionnaire/session 模型。
- 识别 `answers.required`、`answers.extra`、`contentAnswers` 的数据分层。
- 观察 `paidOrder` / `paidUpsellOrders` 与问卷答案分离。
- 将竞品现象转换成 HealthGate 的数据流判断。

最终设计判断：

- HealthGate 使用匿名 `sessionId` 贯穿 funnel、恢复、submit、支付。
- 核心计算字段列化。
- 扩展问卷答案进入 `answersJson`。
- 支付/订阅状态独立建表，不混入 answers。
- 前端不做短表单，而做低压力问题先行的分步 funnel。

AI 的价值：

- 帮助把页面观察转成可落地的数据模型。
- 帮助区分“竞品商业 funnel 策略”和“本题后端工程要求”。

### 2. API 设计

AI 协助做的工作：

- 设计 REST API 路径。
- 统一错误结构。
- 梳理 `POST /api/sessions`、`GET /api/sessions/:id`、`PATCH steps`、`submit`、`result`、`/pay` 的请求/响应。
- 补齐 `VERSION_CONFLICT`、`RESULT_NOT_READY`、`IDEMPOTENCY_CONFLICT` 等异常路径。
- 识别主支付接口必须是 `POST /pay`，不是只做 `/api/pay`。

最终设计判断：

- 除题面指定的 `/pay` 外，其余业务 API 使用 `/api/*`。
- `POST /api/sessions` 采用 create-or-resume 语义。
- `PATCH steps` 支持字段子集，适配 8 个视觉步骤映射到 5 个 API step。
- `GET result` 做字段级权限裁剪，而不是前端遮罩。

AI 的价值：

- 帮助从 happy path 扩展到异常路径。
- 帮助把前端体验和后端 contract 对齐。

### 3. 数据库建模

AI 协助做的工作：

- 初步设计 `users`、`quiz_sessions`、`assessment_results`、`subscriptions`、`payment_events`、`step_events`。
- 对照 API 和测试要求审查 schema。
- 发现并修正 result 一对一建模的问题。
- 补充 result stale 策略、支付幂等约束和 step event 审计。

最终设计判断：

- `QuizSession` 存核心列 + `answersJson`。
- `AssessmentResult` 支持历史结果，一对多关联 session。
- `AssessmentResult` 保存 `sourceSessionVersion` 和 `algorithmVersion`。
- `PaymentEvent` 使用 `@@unique([provider, idempotencyKey])`。
- `StepEvent` 记录每次成功保存，用于审计重复提交、乱序和并发路径。

AI 的价值：

- 帮助发现 schema 与业务流程不一致的地方。
- 帮助把评分点“DB 设计是否经得起推敲”落成约束、索引和审计字段。

### 4. 测试设计

AI 协助做的工作：

- 将题面第四阶段要求拆成单元、集成、E2E、CI。
- 设计测试矩阵。
- 设计测试数据库策略，CI 使用 PostgreSQL service，不污染线上 Supabase。
- 设计受保护字段递归扫描。
- 设计 `/pay` 幂等、幂等冲突、先支付后 submit 等用例。
- 建立测试要求可追踪矩阵。

最终设计判断：

- 算法和访问裁剪用 Vitest unit。
- session、submit、payment 用真实 PostgreSQL integration。
- E2E 只覆盖高价值路径，不把所有非法输入搬到浏览器测。
- README 必须说明覆盖范围和暂不覆盖原因。

AI 的价值：

- 帮助避免“只测 happy path”。
- 帮助把测试要求映射到具体测试文件和断言。

### 5. 前端 funnel 与结果页

AI 协助做的工作：

- 根据竞品调研推导前端形态。
- 比较短表单、多路由问卷、单页 stepper 的取舍。
- 设计 8 个视觉步骤映射到 5 个 API step。
- 设计 preview/full 结果页信息层级。
- 识别 paywall 文案不能泄漏 protected field key。

最终设计判断：

- 前端采用单页分步 funnel + 独立结果页。
- preview 展示 BMI、公开摘要、公开建议和解锁 CTA。
- full 是 preview 的超集，再追加完整计划字段。
- 结果页始终以 API 返回的 `access` 为准，不维护自己的真假会员状态。

AI 的价值：

- 帮助前端保持“足够吸引用户”但不偏离后端评分重点。
- 帮助把权限安全边界落实到页面呈现。

## 被否决或修正的 AI 方案

### 方案 1：优先使用 Neon 作为线上数据库

AI 曾提出 Neon 作为技术上更轻量的 PostgreSQL 选择。

我否决/修正为：

```txt
Supabase PostgreSQL + Prisma
```

原因：

- 题面技术要求明确写到 “Supabase / Prisma + PostgreSQL”。
- 评分标准强调 DB 设计，选 Supabase 更容易解释合规性。
- Neon 技术上可行，但可能让评审产生“是否严格遵守要求”的疑问。

结论：

Neon 只作为技术备选，不作为本项目主方案。

### 方案 2：把支付接口主路径设计成 `/api/pay`

AI 初稿里曾把模拟支付接口写成 `/api/pay`。

我否决/修正为：

```txt
POST /pay
```

原因：

- 题面明确要求提供 `/pay` 接口。
- README 和评审 cURL 应与题面完全一致。
- 可选兼容 `/api/pay`，但主交付路径必须是 `/pay`。

结论：

文档中已统一主路径为 `/pay`。

### 方案 3：AssessmentResult 与 QuizSession 一对一

早期 schema 中 `AssessmentResult.sessionId` 是唯一字段。

我否决/修正为：

```txt
QuizSession 1 -> n AssessmentResult
AssessmentResult(status=CURRENT/STALE)
sourceSessionVersion + algorithmVersion
```

原因：

- 用户完成后可能返回修改核心字段。
- 旧结果不能继续作为当前结果，但也不应该不可审计地覆盖。
- 题目重视状态一致性和边界路径，stale result 是重要证明点。

结论：

改为一对多历史结果模型，并用 service transaction 保证每个 session 只有一个 current result。

### 方案 4：非会员结果页用前端遮罩隐藏完整数据

AI 曾在 UI 讨论中隐含过“前端展示 paywall 即可”的方向。

我修正为：

```txt
API 字段级裁剪，非会员响应根本不返回 protected fields
```

原因：

- 题目明确要求“非会员拿不到被保护字段”。
- 前端隐藏不是鉴权。
- 测试必须递归扫描 preview response keys。

结论：

权限裁剪放在 `access` 模块，结果页只渲染 API 返回内容。

## AI 协作中的质量控制方式

1. 先让 AI 提出选项，再根据题面约束选择。
2. 对 AI 生成的方案做交叉审查：API、DB、前端、测试是否互相一致。
3. 对关键结论要求证据：竞品调研、题面原文、测试可验证性。
4. 不把 AI 输出直接当最终答案，必须审查边界和异常路径。
5. 对每个设计决策留下文档，方便后续实现和评审追问。

具体执行规则：

- 只要 AI 给出技术选型，我会先反查题面是否有显式要求。
- 只要 AI 设计接口，我会追问异常状态、幂等、并发和权限泄漏。
- 只要 AI 生成测试，我会检查它是否覆盖边界和失败路径，而不是只跑 happy path。
- 只要 AI 生成前端方案，我会检查它是否破坏后端鉴权边界，例如把 protected data 先返回给前端再遮罩。
- 只要 AI 给出“已完成”式表述，我会要求用命令、测试、线上链接或文档证据支撑。

## 实现阶段记录

代码实现完成后，复盘补充以下证据：

当前实现阶段记录：

- Prisma migration：已从 schema 生成 migration，并在临时 PostgreSQL 上执行 `prisma migrate deploy` 通过；期间发现 PowerShell 写入 SQL 带 BOM，会导致 Postgres 报 SQL 语法错误，已改为无 BOM。
- 测试数据与边界：已实现 algorithm/validation/access 单元测试，覆盖身高、体重、年龄、目标体重、非法数值、未知字段、跨 step 字段和原型污染。
- 集成流程：已实现 quiz/payment 集成测试，覆盖 create/resume、分步保存、乱序、重复、并发冲突、`/pay` 幂等和 preview/full 转换。
- E2E：已实现 Playwright 测试，覆盖完整 funnel -> preview -> `/pay` -> full，以及刷新恢复。
- CI/deploy：已加入常规 CI workflow 和手动 production-maintenance workflow；公网地址为 `https://healthgate-one.vercel.app`，README 已写入未支付/已支付 demo sessionId。

实现阶段记录：

| 阶段 | AI 做了什么 | 我如何审查 | 最终证据 |
| --- | --- | --- | --- |
| Prisma migration | 根据 schema 生成初始 migration，并同步 Supabase CLI migration | 在临时 PostgreSQL 和 Supabase 上分别执行 migration，修正 SQL BOM 问题 | `prisma/migrations/**`、`supabase/migrations/20260610000000_init.sql`、CI migrate |
| 算法与验证 | 辅助生成 BMI/BMR/TDEE、目标日期和边界测试用例 | 检查目标体重规则、非法数值、字符串数字和健康数据同意边界 | `algorithm.unit.test.ts`、`validation.unit.test.ts` |
| session service | 辅助拆分 create/resume、step patch、submit、stale result 行为 | 用 integration tests 验证乱序、重复、并发和恢复响应结构 | `session.integration.test.ts` |
| access cropper | 辅助定义 preview/full 字段边界和 protected field 列表 | 要求 preview 递归扫描 key，不能只做前端遮罩 | `result-access.unit.test.ts`、`pay.integration.test.ts` |
| `/pay` | 辅助设计 mock payment、subscription upsert 和 idempotencyKey 语义 | 修正主路径必须是题面要求的 `POST /pay`，验证 failed/冲突/重放 | `pay.integration.test.ts`、`tests/e2e/result-access.spec.ts` |
| CI/deploy | 辅助设计 GitHub Actions、Supabase/Vercel 部署路径和 README smoke runbook | 将 production migration 从 Prisma direct 调整为 Supabase CLI，避免 direct IPv6/连接不稳定 | CI run、Production Maintenance run、`https://healthgate-one.vercel.app` |

补写时必须遵守：

- 不把“AI 建议过”写成“项目已实现”。
- 不把“本地手动点过”写成“质量已证明”。
- 每个实现阶段结论至少对应一个文件、命令或测试结果。
- 如果 AI 给出过错误方向，要保留一个具体例子并解释为什么否决。

## 复盘完成标准

最终交付版必须回答四个问题：

1. AI 帮助我更快理解了哪些复杂信息？
2. AI 产出的哪些方案被我采纳，为什么？
3. AI 产出的哪些方案被我否决，为什么？
4. 我如何用测试、文档和线上行为证明最终方案是对的？

## 交付版摘要

最终 README 可引用以下摘要：

```txt
本项目使用 AI 辅助完成竞品数据流分析、API contract 设计、数据库建模、测试矩阵和边界用例设计。关键决策并非直接采纳 AI 输出，而是结合题面要求和评分标准审查后确定。例如，数据库选型从技术可行的 Neon 修正为更贴合题意的 Supabase PostgreSQL；支付接口从 /api/pay 修正为题面要求的 /pay；AssessmentResult 从一对一覆盖模型修正为支持 CURRENT/STALE 的历史模型；权限保护从前端遮罩修正为 API 字段级裁剪。
```
