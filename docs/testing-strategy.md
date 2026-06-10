# 自动化测试策略

## 目标

HealthGate 的测试不是为了凑数量，而是为了证明题面最关心的闭环：

```txt
录入 -> 分步持久化 -> 恢复 -> 服务端计算 -> 权限裁剪 -> /pay -> 完整结果
```

测试设计遵循三条原则：

- 核心算法和权限裁剪用纯函数单元测试，快、稳定、边界覆盖充分。
- 涉及 Prisma、事务、版本号和幂等的流程用真实 PostgreSQL 集成测试。
- 前端 E2E 只覆盖用户关键路径和恢复路径，不把所有后端边界搬到浏览器里测。

题面强制测试要求到具体测试文件的映射见 [测试要求可追踪矩阵](./test-requirements-traceability.md)。

## 测试分层

| 层级 | 工具 | 覆盖内容 | 是否访问数据库 | 运行频率 |
| --- | --- | --- | --- | --- |
| 单元测试 | Vitest | 算法、输入校验、访问裁剪、受保护字段列表 | 否 | 每次提交 |
| 集成测试 | Vitest + Prisma + PostgreSQL | session、step 保存、submit、result、payment、repository 行为 | 是 | 每次提交 |
| E2E 测试 | Playwright | 完整 funnel、刷新恢复、支付后 full result | 是，使用测试库 | CI 和发布前 |
| 构建检查 | TypeScript + Next build | 类型、Next route/page 编译、Prisma generate | 可不访问业务数据 | 每次提交 |

## 覆盖率口径

不追求“全项目 100%”这种低价值指标，重点看核心业务模块：

| 模块 | 覆盖目标 | 原因 |
| --- | --- | --- |
| `assessment` | 行/分支覆盖 80%+ | 算法和边界是评分重点 |
| `quiz` | 关键流程全覆盖 | 分步保存、恢复、version 冲突最容易出错 |
| `access` | 受保护字段路径 100% | 一旦泄漏就是核心失败 |
| `payment` | 幂等分支全覆盖 | `/pay` 是权限闭环入口 |

覆盖率报告用于发现盲区，不用为了提高数字去测试无业务价值的 getter、类型或简单常量。

## 推荐脚本

最终 `package.json` 应提供：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e": "playwright test",
    "test:ci": "npm run typecheck && npm run test:unit && npm run test:integration && npm run build && npm run test:e2e"
  }
}
```

如果时间紧，第一版可以先用单个 `vitest.config.ts`，通过文件命名区分：

```txt
*.unit.test.ts
*.integration.test.ts
```

但 README 必须保证 `npm test` 一键可跑核心自动化测试。

## 测试数据库策略

### CI 使用 PostgreSQL service

CI 不依赖线上 Supabase 数据库，避免：

- 评审 demo 数据被测试污染。
- CI secrets 配置复杂。
- 网络波动导致测试不稳定。

GitHub Actions 使用 `postgres:16` service，并设置：

```txt
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/healthgate_test
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/healthgate_test
```

CI 步骤：

```txt
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
npm run test:e2e
```

### 本地测试

本地推荐使用单独的测试库：

```txt
healthgate_test
```

禁止测试连接生产 Supabase。`.env.test` 或 CI 环境变量必须指向测试库。

### 数据清理

集成测试每个用例使用独立 session，并在测试后清理：

```txt
payment_events
subscriptions
assessment_results
step_events
quiz_sessions
users
```

删除顺序按外键依赖从子表到父表。不要在测试里使用生产 seed sessionId。

## 测试目录建议

```txt
src/modules/assessment/__tests__/algorithm.unit.test.ts
src/modules/assessment/__tests__/validation.unit.test.ts
src/modules/access/__tests__/result-access.unit.test.ts
src/modules/quiz/__tests__/session.integration.test.ts
src/modules/quiz/__tests__/submit.integration.test.ts
src/modules/payment/__tests__/pay.integration.test.ts
src/modules/shared/__tests__/api-errors.unit.test.ts
tests/e2e/funnel.spec.ts
tests/e2e/result-access.spec.ts
tests/factories/session-factory.ts
tests/factories/result-factory.ts
tests/helpers/db.ts
```

## 测试数据工厂

使用工厂函数生成默认合法数据，再通过 override 构造边界：

```txt
validProfile()
validGoal()
validBody()
validActivity()
validHabits()
validCompletedSession()
validPaymentEvent()
```

好处：

- 边界测试只改一个字段，失败原因清楚。
- 集成测试不会到处复制大 JSON。
- 后续新增字段时，先改工厂，再让缺失字段测试暴露真正影响。

目标日期相关测试必须固定当前时间，例如使用 `Clock` abstraction 或 Vitest fake timers。否则 `targetDate` 会随日期变化，快照和断言不稳定。

## 单元测试设计

### 健康评估算法

覆盖：

| 类别 | 用例 |
| --- | --- |
| 正常路径 | 减重、维持、增重 |
| BMI 边界 | 身高 90/243、体重 24.9/300、目标 BMI 18.5/40 |
| 非法值 | 缺失、`NaN`、`Infinity`、字符串数字、负数、0 |
| 年龄边界 | 15、16、99、100 |
| 目标合理性 | 减重目标反向、目标 BMI 过低/过高、非减重目标变化超过 35% |
| consent | `healthDataConsent=false` 不允许 submit |
| 输出稳定性 | BMI 小数位、targetDate、projectionCurve 单调逼近目标 |

断言不要只判断“有值”，要断言：

- `bmi` 约等于预期。
- `goalDirection` 正确。
- `recommendedCalories` 不低于安全下限。
- `projectionCurve[0]` 等于当前体重。
- projection curve 日期递增，体重朝目标方向变化。

### 访问裁剪

覆盖：

- preview 只保留公开字段。
- preview 深层对象中也不包含受保护字段。
- full 是 preview 的超集。
- 新增受保护字段时，测试会失败，提醒更新 `protected-fields.ts`。

受保护字段断言要递归扫描所有 key，而不是只检查顶层：

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

### Paywall 文案安全

`paywall.features` 可以包含“目标日期与趋势”这类用户文案，但不能包含原始字段 key：

```txt
targetDate
projectionCurve
recommendedCalories
bmr
tdee
```

这能防止前端把 API 字段名直接展示给非会员。

## 集成测试设计

### Session 创建与恢复

覆盖：

- `POST /api/sessions` 首次创建 session。
- `resumeExisting=true` 且 cookie 有效时返回已有 session。
- `resumeExisting=false` 创建新 session 并刷新 cookie。
- URL/path 显式 `sessionId` 优先于 cookie。
- `GET /api/sessions/:id` 返回 `required` + `extra` 结构。

这些测试应尽量覆盖 HTTP contract，而不只测 service：

- 状态码。
- 统一错误结构。
- 响应 JSON shape。
- cookie 设置和刷新。
- `sessionId` path/body/cookie 优先级。

实现上可以直接 import Next Route Handler，用 `NextRequest` 构造请求；不需要每个 API 集成测试都启动完整浏览器。

### Step 保存

覆盖：

- 每个 step 保存后 version +1。
- 同一 API step 允许分多次保存字段子集，例如先 `goalType`，再 `bodyZones`。
- `completedSteps` 按必需字段完整度计算，而不是按 PATCH 调用次数。
- 乱序保存允许，但 submit 不完整时返回 `422 INCOMPLETE_SESSION`。
- 重复提交同一步，最新值生效，version 递增。
- stale `expectedVersion` 返回 `409 VERSION_CONFLICT`，数据库不被静默覆盖。
- 并发更新用 `Promise.all` 模拟，只有一个成功，另一个冲突。

### 输入校验与注入

覆盖：

- unknown stepKey。
- 跨 step 字段。
- 未知字段。
- `__proto__` / `constructor` 等原型污染字段。
- 字符串数字，例如 `"168"`。
- `NaN` / `Infinity`。
- 超长数组、重复数组项、非法枚举项。
- 目标体重导致 BMI 越界。

### Submit 与结果持久化

覆盖：

- 必需字段完整后 submit 创建 `assessment_results`。
- submit 响应包含 `resultId`、`algorithmVersion`、`version`。
- 重复 submit 返回同一个当前 result，不重复创建。
- completed 后修改核心字段，result stale，`GET result` 返回 `409 RESULT_NOT_READY`。
- completed 后修改扩展字段，不强制 stale，但 version 和 step event 递增。

### Result 与权限

覆盖：

- submit 前 `GET result` 返回 `409 RESULT_NOT_READY`。
- 非会员 `GET result` 返回 `access=preview`。
- preview 不包含受保护字段，递归扫描所有 key。
- preview 包含 `paywall.message`、`paywall.ctaLabel`、`paywall.features`。
- full 是 preview 的超集，并包含受保护字段。

### Payment

覆盖：

- `POST /pay status=succeeded` 创建 payment event，激活 subscription。
- `POST /pay status=failed` 创建 failed event，不激活 subscription。
- 同 idempotencyKey + 同 session + 同 status 重放，不重复创建 event。
- 同 idempotencyKey + 不同 session 或不同 status，返回 `409 IDEMPOTENCY_CONFLICT`。
- 支付成功不修改 answers，不重新计算 result。
- 先支付后 submit：subscription 先 active，submit 后 result 直接 full。

### API 错误合约

所有 API 错误都要符合统一结构：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": []
  }
}
```

至少覆盖：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `VERSION_CONFLICT`
- `IDEMPOTENCY_CONFLICT`
- `INCOMPLETE_SESSION`
- `RESULT_NOT_READY`

这样 README 的 cURL、前端错误展示和测试断言使用的是同一套 contract。

## E2E 设计

E2E 只保留高价值路径：

### 完整 funnel

```txt
打开 /
-> 完成 8 个视觉步骤
-> submit
-> 进入 /result?sessionId=...
-> 看到 BMI、公开建议、解锁 CTA
-> 点击解锁完整计划
-> 看到目标日期、每日建议、趋势
-> 刷新
-> 仍然是 full
```

### 中断恢复

```txt
打开 /
-> 完成 profile 和 goal
-> 刷新
-> 已选答案仍在
-> 恢复到身体数据步骤
```

### 已完成恢复

```txt
完成 funnel
-> 再次打开 /?sessionId=...
-> 自动跳转 /result?sessionId=...
```

E2E 不覆盖所有非法输入，否则维护成本过高。非法输入由单元和集成测试覆盖。

## CI 设计

推荐 GitHub Actions job：

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

实现阶段如果 E2E 太慢，可以先让 CI 跑一个 smoke E2E，但 README 必须说明完整 E2E 的本地运行方式。

## 不覆盖内容

自动化测试第一版不覆盖：

- 真实支付网关。
- 多浏览器视觉像素差异。
- 医学级风险评估正确性。
- 长期订阅续费、退款、过期。
- 大规模性能压测。

这些不属于题目核心评分点。README 要明确说明未覆盖原因，避免让评审误以为遗漏。
