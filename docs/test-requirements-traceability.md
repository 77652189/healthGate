# 测试要求可追踪矩阵

## 目的

这份文档把题面第四阶段“测试与质量保障”的要求逐条映射到 HealthGate 的自动化测试设计中。

当前状态：

- 设计覆盖：已完成。
- 测试代码：已实现。
- CI workflow：已实现。
- README 测试说明：已更新，公网 URL 与 CI badge 状态待部署/推送后确认。

这份矩阵后续应成为 README 测试覆盖说明和实现任务拆分的来源。

## 总览

| 题面要求 | 覆盖策略 | 计划测试文件 | 当前状态 |
| --- | --- | --- | --- |
| 健康评估算法单元测试 | Vitest unit，纯函数测试 | `src/modules/assessment/__tests__/algorithm.unit.test.ts` | 已实现 |
| 极端/缺失/非法身高、体重、年龄 | Vitest unit + validation unit | `src/modules/assessment/__tests__/validation.unit.test.ts` | 已实现 |
| 目标体重不合理 | Vitest unit | `src/modules/assessment/__tests__/algorithm.unit.test.ts` | 已实现 |
| 分步保存 + 进度恢复 | Vitest integration + PostgreSQL | `src/modules/quiz/__tests__/session.integration.test.ts` | 已实现 |
| 中断后恢复 | Vitest integration + Playwright E2E | `session.integration.test.ts`, `tests/e2e/result-access.spec.ts` | 已实现 |
| 乱序 / 重复提交 | Vitest integration | `src/modules/quiz/__tests__/session.integration.test.ts` | 已实现 |
| 并发更新 | Vitest integration，用 `Promise.all` 模拟冲突 | `src/modules/quiz/__tests__/session.integration.test.ts` | 已实现 |
| 非会员脱敏 vs 会员完整 | Vitest unit + integration | `src/modules/access/__tests__/result-access.unit.test.ts`, `src/modules/payment/__tests__/pay.integration.test.ts` | 已实现 |
| 非会员拿不到被保护字段 | 递归扫描 preview response keys | `result-access.unit.test.ts`, `pay.integration.test.ts` | 已实现 |
| `/pay` 后状态变更 | Vitest integration | `src/modules/payment/__tests__/pay.integration.test.ts` | 已实现 |
| preview -> pay -> full E2E | Playwright | `tests/e2e/result-access.spec.ts` | 已实现 |
| 非法数值注入与越界输入 | Vitest unit + integration | `validation.unit.test.ts`, `session.integration.test.ts` | 已实现 |
| 一键运行测试 | npm scripts | `package.json` | 已实现 |
| GitHub Actions CI | PostgreSQL service + typecheck/test/build/E2E | `.github/workflows/ci.yml` | 已实现 |
| README 覆盖范围与未覆盖原因 | README 交付章节 | `README.md` | 已实现 |

## 详细映射

### 1. 健康评估算法单元测试

题面要求：

```txt
健康评估算法的单元测试
含边界：极端 / 缺失 / 非法的身高、体重、年龄，目标体重不合理等
```

计划文件：

```txt
src/modules/assessment/__tests__/algorithm.unit.test.ts
src/modules/assessment/__tests__/validation.unit.test.ts
```

必须覆盖：

| 用例组 | 具体用例 | 关键断言 |
| --- | --- | --- |
| 正常减重 | 32 岁、168cm、74kg -> 65kg | BMI、TDEE、recommendedCalories、targetDate 合理 |
| 正常维持 | currentWeight = targetWeight | `goalDirection=maintain` |
| 正常增重 | targetWeight > currentWeight | calorie plan 高于 TDEE |
| 身高边界 | 89、90、243、244 | 89/244 rejected，90/243 accepted |
| 体重边界 | 24、24.9、300、301 | 24/301 rejected，24.9/300 accepted |
| 年龄边界 | 15、16、99、100 | 15/100 rejected，16/99 accepted |
| 非法数值 | `NaN`、`Infinity`、字符串数字、0、负数 | validation error |
| 目标体重不合理 | 减重目标 >= 当前体重 | validation error |
| 目标 BMI 不合理 | target BMI < 18.5 或 > 40 | validation error |
| 未同意健康数据 | `healthDataConsent=false` | validation error |
| projection curve | 正常输入 | 日期递增，体重朝目标方向变化 |

完成标准：

- 不能只断言“返回了一个对象”。
- 必须断言关键数值范围、方向和边界错误。
- 目标日期测试必须固定当前时间，避免随日期漂移。

### 2. 分步保存 + 进度恢复集成测试

题面要求：

```txt
分步保存 + 进度恢复的集成测试
中断后恢复、乱序 / 重复提交、并发更新
```

计划文件：

```txt
src/modules/quiz/__tests__/session.integration.test.ts
src/modules/quiz/__tests__/submit.integration.test.ts
tests/e2e/funnel.spec.ts
```

必须覆盖：

| 用例组 | 具体用例 | 关键断言 |
| --- | --- | --- |
| 创建 session | `POST /api/sessions` | 返回 `sessionId/version/currentStep/status`，设置 cookie |
| create-or-resume | cookie + `resumeExisting=true` | 返回已有 session |
| 重新开始 | `resumeExisting=false` | 创建新 session，刷新 cookie |
| 显式 session 优先 | path sessionId 与 cookie 不同 | 以 path/body sessionId 为准 |
| 子集保存 | `goal` 先保存 `goalType`，再保存 `bodyZones` | 两次 PATCH 都合法，version 递增 |
| completedSteps | step 字段未完整 | 不把 step 标记为 completed |
| 乱序保存 | 未保存 goal 先保存 body | 保存成功，submit 时仍检查完整性 |
| 重复提交 | 同一步 PATCH 多次 | 最新答案生效，version 递增 |
| 并发更新 | 两个请求使用同一个 expectedVersion | 一个成功，一个 `409 VERSION_CONFLICT` |
| 中断恢复 | 保存前 3 个视觉步骤后刷新 | 已选答案仍在，恢复到身体数据步骤 |
| 完成后恢复 | completed session 再打开首页 | 自动进入结果页 |

完成标准：

- 集成测试使用 PostgreSQL 测试库。
- 并发测试必须验证数据库最终状态没有静默覆盖。
- 恢复响应必须同时验证 `answers.required` 和 `answers.extra`。

### 3. 鉴权差异化返回测试

题面要求：

```txt
鉴权差异化返回的测试
非会员脱敏 vs 会员完整，确保非会员拿不到被保护字段
```

计划文件：

```txt
src/modules/access/__tests__/result-access.unit.test.ts
src/modules/payment/__tests__/pay.integration.test.ts
```

受保护字段：

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

必须覆盖：

| 用例组 | 具体用例 | 关键断言 |
| --- | --- | --- |
| preview | 未支付 `GET result` | `access=preview` |
| preview 字段 | 未支付 response | 只包含公开字段和 paywall |
| 深层泄漏 | 递归扫描 response 所有 key | 不出现任何受保护字段 |
| paywall 安全 | `paywall.features` | 不包含原始字段 key 或具体受保护数值 |
| full | 支付后 `GET result` | `access=full`，包含公开字段和受保护字段 |
| full 超集 | 支付后 response | full 保留 `publicSummary/publicRecommendations` |

完成标准：

- 非会员不能返回 protected field 的 `null`，必须完全不包含字段。
- 测试要递归扫描 key，不能只检查顶层。
- 新增 protected field 时，测试应失败并提醒更新 `protected-fields.ts`。

### 4. `/pay` 回调与结果页 E2E

题面要求：

```txt
/pay 回调后状态变更
结果页返回从「脱敏」变为「完整」的端到端验证
```

计划文件：

```txt
src/modules/payment/__tests__/pay.integration.test.ts
tests/e2e/result-access.spec.ts
```

必须覆盖：

| 用例组 | 具体用例 | 关键断言 |
| --- | --- | --- |
| 支付成功 | `POST /pay status=succeeded` | 创建 payment event，subscription active |
| 支付失败 | `POST /pay status=failed` | 创建 failed event，不激活 subscription |
| 幂等重放 | 同 key + 同 session + 同 status | 不重复创建 payment event |
| 幂等冲突 | 同 key + 不同 session/status | `409 IDEMPOTENCY_CONFLICT` |
| 支付不重算 | pay 前后 resultId/核心结果 | result 不变，只改变访问权限 |
| 先支付后提交 | DRAFT session 先 pay，再 submit | result 生成后直接 full |
| E2E 转换 | preview -> click pay -> full | 页面出现目标日期、每日建议、趋势 |

完成标准：

- `/pay` 不修改 answers。
- `/pay` 不重新计算 assessment result。
- E2E 通过页面内容验证 full，而不是只检查接口状态码。

### 5. 数据验证与非法输入

题面要求：

```txt
接口要能挡住非法数值注入与越界输入，并对这些情况有测试覆盖
```

计划文件：

```txt
src/modules/assessment/__tests__/validation.unit.test.ts
src/modules/quiz/__tests__/session.integration.test.ts
src/modules/shared/__tests__/api-errors.unit.test.ts
```

必须覆盖：

| 输入类型 | 示例 | 预期 |
| --- | --- | --- |
| 字符串数字 | `"168"` | `400 VALIDATION_ERROR` |
| 非数值 | `NaN`, `Infinity` | `400 VALIDATION_ERROR` |
| 越界数值 | height 89/244, weight 24/301, age 15/100 | `400 VALIDATION_ERROR` |
| 原型污染 | `__proto__`, `constructor` | `400 VALIDATION_ERROR` |
| 未知字段 | profile 携带 unknown key | `400 VALIDATION_ERROR` |
| 跨 step 字段 | profile 携带 `heightCm` | `400 VALIDATION_ERROR` |
| 超长数组 | bodyZones 超过 6 项 | `400 VALIDATION_ERROR` |
| 非法枚举 | `activityLevel="super_active"` | `400 VALIDATION_ERROR` |
| 目标 BMI 越界 | target BMI < 18.5 或 > 40 | `400/422 VALIDATION_ERROR` |

完成标准：

- API 错误统一返回 `{ error: { code, message, details } }`。
- 错误测试要断言 HTTP status 和 error code。
- 不接受 Zod 隐式 coercion 把字符串数字转成 number。

### 6. 一键运行与 CI

题面要求：

```txt
提供一键运行测试的方式，如 npm test
若能接入 CI 让测试自动跑起来并贴出通过状态，加分
```

计划文件：

```txt
package.json
.github/workflows/ci.yml
README.md
```

必须提供脚本：

| 命令 | 用途 | 当前状态 |
| --- | --- | --- |
| `npm test` | 一键运行核心自动化测试 | 已有脚本，待补真实测试 |
| `npm run typecheck` | TypeScript 类型检查 | 已有 |
| `npm run build` | Next build + Prisma generate | 已有 |
| `npm run test:e2e` | Playwright E2E | 待添加 |
| `npm run test:ci` | CI 聚合命令 | 待添加 |

CI 必须运行：

```txt
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
npm run test:e2e
```

完成标准：

- GitHub Actions 使用 PostgreSQL service。
- CI 不连接线上 Supabase。
- README 有测试命令、覆盖范围、未覆盖内容和 CI 状态说明。

## 实现任务拆分

为了让测试真正落地，实现阶段按这个顺序推进：

1. 补齐测试脚本和测试依赖。
2. 建立测试数据库 helper、数据工厂和清理逻辑。
3. 先写算法/validation/access 单元测试。
4. 再写 quiz/payment 集成测试。
5. 最后写 Playwright E2E。
6. 接入 GitHub Actions。
7. README 补测试覆盖范围、未覆盖内容和 CI badge。

## 最终交付判定

只有同时满足以下条件，才能说第四阶段测试要求“已达到”：

- `npm test` 本地一键通过。
- 集成测试使用测试 PostgreSQL，不污染线上 Supabase。
- preview 响应递归扫描确认不泄漏 protected fields。
- `/pay` 成功后同一 session 从 preview 变 full。
- GitHub Actions 最新一次通过。
- README 写明覆盖范围、未覆盖内容和运行方式。
