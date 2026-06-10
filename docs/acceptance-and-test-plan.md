# 验收标准与测试计划

## 验收目标

这个项目需要证明三件事：

1. 漏斗流程可以完整跑通。
2. 后端状态和权限逻辑是可靠的。
3. 自动化测试能覆盖核心逻辑、边界和异常路径。

不能只说“我本地点了一下没问题”。

## 功能验收标准

### 1. 测评数据流与状态恢复

必须满足：

- 用户进入页面时创建匿名 session。
- 每一步提交后后端保存增量答案。
- 刷新页面后能恢复已填写答案。
- 关闭页面后用同一个 sessionId 能恢复。
- 恢复响应能区分核心计算字段和扩展答案。
- 重复提交同一步不会产生不可恢复状态。
- 乱序提交允许保存，但 submit 时必须校验完整性。
- 并发更新使用 `expectedVersion` 防止静默覆盖。
- 未知 stepKey、跨 step 字段和未知字段会被拒绝。
- 已完成测评后修改核心字段会使旧结果失效，必须重新 submit。

验收方式：

- 页面手动演示。
- API curl 演示。
- 集成测试覆盖。

### 2. 服务端计算逻辑

必须满足：

- 完整提交后服务端计算 BMI。
- 计算 BMI category。
- 计算 BMR/TDEE。
- 计算建议每日摄入量。
- 计算目标预测日期。
- 生成 projection curve。
- 结果持久化到数据库。

验收方式：

- 单元测试固定输入输出。
- 集成测试验证 submit 后数据库存在 result。
- README 说明公式和边界。

### 3. 订阅鉴权与权限保护

必须满足：

- 未支付时结果接口返回 preview。
- preview 只包含公开字段。
- preview 不包含受保护字段名。
- preview paywall 展示 CTA 和用户可读的解锁能力，但不包含受保护字段 key 或伪造数值。
- `/pay` 成功后订阅状态变 active。
- 支付后同一个结果接口返回 full。
- `/pay` 使用 idempotencyKey，重复调用不重复创建支付事件。
- 支付成功只改变访问权限，不篡改 questionnaire answers 或 assessment result。

验收方式：

- API 测试断言字段。
- 端到端测试走完整流程。
- README 提供一个已支付 sessionId。

### 4. 前端基础体验

必须满足：

- 用户能从第一步走到结果页。
- 页面文案中文优先，少用技术术语。
- 身体数据输入前有健康数据说明/同意。
- 非会员结果页明确展示预览价值和解锁 CTA。
- 支付模拟后结果页能展示完整数据。

验收方式：

- 线上链接手动演示。
- 少量 Playwright E2E。

## 测试矩阵

详细测试组织、数据库策略、CI 设计见 [自动化测试策略](./testing-strategy.md)。题面强制要求与计划测试文件的逐项映射见 [测试要求可追踪矩阵](./test-requirements-traceability.md)。本节保留面向验收的测试清单。

### 单元测试：健康评估算法

| 用例 | 输入 | 预期 |
| --- | --- | --- |
| 正常减重 | 32 岁、168cm、74kg -> 65kg | BMI、TDEE、targetDate 合理 |
| 正常维持 | currentWeight = targetWeight | goalDirection 为 maintain |
| 正常增重 | targetWeight > currentWeight | caloriePlan 高于 TDEE |
| 身高缺失 | heightCm 缺失 | validation error |
| 身高过低 | 89cm | validation error |
| 身高过高 | 244cm | validation error |
| 体重过低 | 24kg | validation error |
| 体重过高 | 301kg | validation error |
| 年龄过低 | 15 | validation error |
| 年龄过高 | 100 | validation error |
| 减重目标反向 | goal=lose_weight, target >= current | validation error |
| 目标 BMI 过低 | target leads BMI < 18.5 | validation error |
| 未同意健康数据 | healthDataConsent=false | validation error |

### 集成测试：分步保存与恢复

| 用例 | 步骤 | 预期 |
| --- | --- | --- |
| 创建 session | POST /api/sessions | 返回 sessionId/version |
| 保存 profile | PATCH profile | version +1 |
| 恢复 profile | GET session | gender 已保存 |
| 核心/扩展分离 | PATCH profile/goal/habits 后 GET session | required 中有核心字段，extra 中有体型/习惯字段 |
| 乱序保存 body | 未保存 goal 先保存 body | 保存成功，但 status 仍 draft |
| submit 不完整 | 缺 activity | 422 INCOMPLETE_SESSION |
| 重复提交 | 连续 PATCH 同一步 | 最新答案生效，version 递增 |
| 并发冲突 | expectedVersion 过期 | 409 VERSION_CONFLICT |
| 未知 stepKey | PATCH `/steps/unknown` | 400 VALIDATION_ERROR |
| 跨 step 字段 | profile step 携带 heightCm | 400 VALIDATION_ERROR |
| 非法注入 | 字符串身高、超长数组、`__proto__` 字段 | 400 VALIDATION_ERROR |
| 完成后修改核心字段 | submit 后修改 currentWeightKg，再 GET result | 409 RESULT_NOT_READY |
| 完成后修改扩展字段 | submit 后修改 sleepHours，再 GET result | 仍返回当前 result，version 递增 |

### 集成测试：结果和权限

| 用例 | 步骤 | 预期 |
| --- | --- | --- |
| 完整 submit | 所有必需字段后 submit | result 创建 |
| submit 前 result | GET result | 409 RESULT_NOT_READY |
| 未支付 result | GET result | access=preview |
| 保护字段检查 | preview result | 不包含 bmr/tdee/recommendedCalories/goalDirection/weeklyDeltaKg/targetDate/projectionCurve/caloriePlan |
| Paywall 文案检查 | preview result | 包含 paywall.message/ctaLabel/features，features 不包含原始字段 key |
| 支付成功 | POST /pay succeeded | subscription active |
| 支付后 result | GET result | access=full，包含公开字段和受保护字段 |
| 支付失败 | POST /pay failed | subscription 不激活 |
| 支付幂等 | 同 idempotencyKey 重复调用 | payment event 不重复 |
| 支付幂等冲突 | 同 idempotencyKey 换 session/status 调用 | 409 IDEMPOTENCY_CONFLICT |
| 先支付后提交 | DRAFT session 先 POST /pay，再补齐 submit | result 生成后直接 access=full |
| 支付不改结果 | pay 前后查询 result id/核心结果 | result 不被重算或篡改，只是字段可见性变化 |

### E2E 测试：用户路径

最小 E2E：

```txt
打开首页
-> 创建 session
-> 完成 funnel
-> 进入结果页
-> 看到 BMI、公开建议和解锁 CTA
-> 点击模拟支付
-> 结果页刷新为 full
-> 看到目标日期、每日摄入建议和趋势
```

中断恢复 E2E：

```txt
打开首页
-> 完成 profile 和 goal 相关视觉步骤
-> 刷新页面
-> 仍保留已选答案
-> 恢复到身体数据步骤
```

完成后恢复 E2E：

```txt
完成 funnel 并生成结果
-> 再次打开 /?sessionId=...
-> 自动进入 /result?sessionId=...
```

E2E 不需要覆盖所有边界，边界由单元和集成测试覆盖。

## 数据验证范围

参考竞品身高页和 bundle 常量，HealthGate 建议范围：

| 字段 | 范围 | 原因 |
| --- | --- | --- |
| age | 16-99 | 成人/准成人产品边界，避免儿童健康建议 |
| heightCm | 90-243 | 竞品观察边界 |
| currentWeightKg | 24.9-300 | 竞品观察边界 |
| targetWeightKg | 24.9-300 | 与当前体重同范围 |
| target BMI | 18.5-40 | 避免明显不健康目标 |
| bodyZones | 1-6 个枚举字符串 | 防止数组注入/滥用 |
| physicalLimitations | 0-6 个短字符串 | 防止数组注入/滥用 |

## 数据流验收清单

这部分直接对应竞品调研要求：“哪些步骤产生哪些数据、哪些数据需要持久化、订阅前后用户能拿到什么”。

| 验收项 | 证明方式 |
| --- | --- |
| profile step 产生 gender/ageRange | API 测试 + 恢复响应 |
| goal step 产生 goalType/bodyZones/desiredBodyShape | API 测试 + 恢复响应 |
| body step 产生 age/height/currentWeight/targetWeight/consent | API 测试 + submit 计算 |
| activity step 产生 activityLevel/exerciseFrequency | API 测试 + TDEE 计算 |
| habits step 产生 sleep/water/diet/limitations | API 测试 + `answers.extra` |
| 核心字段列化 | 数据库/repository 测试 |
| 扩展字段 JSON 化 | 恢复响应和 repository 测试 |
| 派生结果持久化 | submit 后 result 存在 |
| 非会员只能拿 preview | result API 测试 |
| 会员拿 full | pay 后 result API 测试 |
| 受保护字段不泄漏 | preview 响应字段快照测试 |

## CI 验收

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

CI 使用 GitHub Actions PostgreSQL service 作为测试库，不连接线上 Supabase，不污染 demo 数据。E2E 如果耗时过高，至少保留一个 smoke E2E，并在 README 说明完整 E2E 的本地运行方式。

## README 必须说明

README 需要包含：

- 线上演示链接。
- GitHub 仓库链接。
- 本地启动方式。
- 环境变量说明。
- API 文档摘要。
- `/pay` cURL 示例。
- 一个未支付测试 sessionId。
- 一个已支付测试 sessionId。
- 数据库 Schema 图。
- 测试覆盖范围。
- 暂未覆盖内容和原因。
- AI 使用复盘。

## 暂不覆盖的内容

为了 3 天交付聚焦，以下内容可以明确说明暂不覆盖：

- 真实支付网关。
- 用户注册登录。
- 医学级风险评估。
- 多语言。
- 复杂动态问卷配置平台。
- 长期订阅续费/退款。

这些不属于本题核心评分点。
