# 竞品调研：BetterMe Quiz Funnel

调研对象：[BetterMe Pilates Quiz Funnel](https://betterme-pilates.com/first-page-brand-palette?flow=2117)

调研目的不是 1:1 复刻页面，而是理解一个健康测评 funnel 背后的数据流、会话模型、答案结构、校验边界和订阅闭环，并据此设计 HealthGate 的后端骨架。

## 调研边界

- 只观察公开页面、公开 HTML、公开前端 bundle 和匿名 questionnaire 恢复接口。
- 使用虚构路径进入 funnel，未提交真实个人身份信息。
- 在身高输入页停止，没有继续提交具体健康数据。
- 未进入真实支付流程，也未模拟绕过支付。

这个边界很重要：我们的目标是推断工程结构，而不是采集竞品业务数据。

## 页面流程证据

实际从首屏进入后，观察到 funnel 不是简单表单，而是多阶段个性化问卷。

已观察到的问题类型包括：

| 阶段 | 观察到的问题 | 数据性质 |
| --- | --- | --- |
| 首屏分群 | 年龄段：18-29、30-39、40-49、50+ | 低摩擦画像字段 |
| 目标 | 主目标：减重、增强力量、提升柔韧性、减压、改善体态 | 核心目标字段 |
| 体型画像 | 当前体型、理想体型 | 个性化展示字段 |
| 体重倾向 | 体重通常如何变化 | 解释型字段 |
| 运动经验 | 是否尝试过 Pilates、柔韧性、爬楼是否气喘 | 运动能力画像 |
| 多选目标 | Belly、Butt、Legs、Chest | 目标区域，多选字段 |
| 健康限制 | Sensitive back、Sensitive knees、None of the above | 风险/限制字段 |
| 运动频率 | How often do you exercise? | 核心活动字段 |
| 生活方式 | 步行频率、工作作息、日常活动、能量水平、饮水、睡眠 | 扩展画像字段 |
| 饮食 | 三餐时间、饮食偏好、坏习惯 | 内容个性化字段 |
| 体重原因 | 近年导致体重增加的生活事件 | 动机/解释字段 |
| 身体数据 | 身高输入页 | 健康计算必需字段 |

结论：

竞品先收集大量“低压力、可点击”的画像答案，建立个性化感，再进入更敏感的身体数据输入。这说明 HealthGate 前端不应只是一个短表单；即使 UI 不是评分重点，也应保留 funnel 节奏，让用户愿意走到结果页。

## 数据流分析：哪些步骤产生哪些数据

本节把页面观察转成后端设计输入。这里区分三类数据：

- 核心计算数据：必须强校验、强类型持久化，直接进入健康评估算法。
- 个性化展示数据：应持久化，但更适合放在 `answers_json`，用于结果页文案和推荐理由。
- 过程/转化数据：可以记录为事件或扩展答案，不应污染核心算法。

| Funnel 步骤 | 观察到的问题 | 产生的数据 | 竞品结构线索 | HealthGate 持久化判断 |
| --- | --- | --- | --- | --- |
| 首屏年龄段 | `Age: 18-29/30-39/40-49/50+` | age range、flow、匿名 order id | URL 从 first-page 进入带 `order=<uuid>` 的 questionnaire | 保存为 session 初始画像；后续精确年龄进入核心字段 |
| 主目标 | Lose weight、strength、flexibility、stress、posture | `goalType` | API `answers.required.goalType` | 核心列，影响目标方向和结果文案 |
| 当前体型 | Slim、Mid-sized、Plus-sized 等 | current body shape | 更像 content answer | 存 `answers_json`，用于结果页个性化，不参与 BMI |
| 理想体型 | Thin、Toned、Curvy、Average | desired body shape | 更像 content answer | 存 `answers_json`，用于目标描述 |
| 体重变化倾向 | gain/lose weight tendency | metabolism/weight tendency | bundle 有预测和推荐文案 | 存 `answers_json`，可影响建议文案，不作为核心公式输入 |
| 运动经验 | Pilates 经验、柔韧性、爬楼气喘 | fitness level、capacity signals | API 有 `fitnessLevel` | `fitnessLevel` 可列化或 JSON；MVP 中优先 JSON |
| 目标区域多选 | Belly、Butt、Legs、Chest | `bodyZones[]` | API `answers.required.bodyZones` | 可作为 JSON 列或数组 JSON，结果页可展示 |
| 身体限制多选 | Sensitive back/knees | `physicalLimitations[]` | API `answers.required.physicalLimitations` | 持久化，影响安全提示和免责声明 |
| 运动频率 | How often do you exercise? | activity/exercise frequency | API `activities`，题目也明确要求运动频率 | 核心列，影响 TDEE/activity factor |
| 生活习惯 | 步行、作息、活动、能量、饮水、睡眠 | lifestyle answers | 更像 `extra/contentAnswers` | 存 `answers_json`，用于推荐解释 |
| 饮食习惯 | 三餐时间、饮食偏好、坏习惯 | nutrition preferences | API 有 `dietId`，bundle 有 meal-plan 文案 | `dietPreference` 可存 JSON；不进入基础 BMI 公式 |
| 体重原因 | 生活事件、压力等 | motivation/context | 更像 content answer | 存 `answers_json`，用于结果页共情文案 |
| 身体数据 | 身高、体重、目标体重、年龄 | age、heightCm、currentWeightKg、targetWeightKg | API `answers.required` 明确列出这些字段 | 核心列，必须强校验并进入算法 |
| 健康数据同意 | onboarding data consent checkbox | health data consent | 身高页出现明确 consent | 核心布尔字段，未同意不能 submit |

核心判断：

HealthGate 不应该把所有问题都设计成数据库列。竞品问题很多，如果全列化会导致 schema 僵硬；但 BMI、热量、目标日期依赖的字段必须列化，否则无法体现后端建模能力。最合理的折中是：

```txt
typed columns: gender, goalType, age, heightCm, currentWeightKg, targetWeightKg, activityLevel, exerciseFrequency, healthDataConsent
answers_json: body shape, desired body, habits, diet, motivation, limitations, marketing/context answers
derived result: bmi, bmr, tdee, caloriePlan, targetDate, projectionCurve
```

## URL 与匿名会话证据

首屏 URL：

```txt
/first-page-brand-palette?flow=2117
```

选择年龄段并继续后，URL 变为：

```txt
/generated-questionary-brand-palette?flow=2117&order=<uuid>
```

其中 `order=<uuid>` 可用于恢复 questionnaire。

结论：

竞品使用匿名 questionnaire/session id 贯穿 funnel。HealthGate 应采用类似的 session-first 模型：

```txt
visitor -> quiz_session -> answers -> assessment_result -> payment/subscription -> protected_result
```

不建议在挑战项目里先做完整注册登录，因为题目强调的是分步保存、恢复、计算和订阅权限，而不是账号系统。

## API Host 证据

页面 HTML 中公开环境变量显示：

```txt
API_WITH_PS_PATH=https://api-ps.quiz.betterme.world
WEB_CONSTRUCTOR_API=https://api.web-constructor.betterme.world
```

结论：

竞品前端页面和业务 API 分离：

- 页面域负责 funnel 展示。
- API 服务负责 questionnaire、answers、order、payment status。
- constructor API 可能负责动态页面/问卷配置。

HealthGate 不需要拆成多个服务，但代码边界应模拟这种分层：页面、API route、domain service、repository 分开。

## 恢复接口证据

使用匿名 `order` id 可以请求 questionnaire 恢复接口：

```txt
GET https://api-ps.quiz.betterme.world/api/v2/questionnaires/:id
GET https://api-ps.quiz.betterme.world/api/v3/questionnaires/:id
```

观察到的响应字段包括：

```json
{
  "id": "<uuid>",
  "email": null,
  "flowTopic": "pilatesBegin_2117",
  "country": "jp",
  "subProduct": "HEALTH_COACHING_QUIZ",
  "paidOrder": null,
  "paidUpsellOrders": [],
  "answers": {
    "required": {
      "bodyZones": null,
      "activities": null,
      "goalType": null,
      "gender": null,
      "fitnessLevel": null,
      "name": null,
      "age": null,
      "heightCm": null,
      "currentWeightKg": null,
      "targetWeightKg": null,
      "dietId": null,
      "physicalLimitations": null,
      "preferredMeasureSystem": "imperial",
      "workoutPlace": null
    },
    "extra": null,
    "contentAnswers": null
  }
}
```

结论：

竞品答案模型不是纯 JSON，也不是全字段列化，而是混合结构：

- `answers.required`：核心强类型字段，支撑计算/推荐。
- `answers.extra` / `contentAnswers`：扩展问题，用于内容个性化。
- `paidOrder` / `paidUpsellOrders`：支付/订阅状态不混在 answers 里。

HealthGate 应采用类似思路：

- 核心字段放数据库列，便于校验、查询和计算。
- 扩展答案放 `answers_json`，便于后续加题。
- 支付事件和订阅状态单独建表。

## 前端 Bundle 证据

在前端 bundle 中观察到类似 API client 方法名：

```txt
createBaseQuestionnaire
fetchQuestionnaire
updateQuestionnaire
updateQuestionnaireAnswers
updateEmail
createOrderBulk
getOrderStatus
```

也观察到接口路径模式：

```txt
/questionnaires
/questionnaires/:id
/questionnaires/:id/answers
/questionnaires/:id/email
/questionnaires/:id/order/bulk
/orders/:id/status
```

结论：

竞品的数据流可以抽象为：

```txt
create questionnaire
-> collect answers
-> update email / health fields
-> create order
-> check order status
-> unlock paid experience
```

HealthGate 对应设计：

```txt
create quiz session
-> save step answers
-> submit assessment
-> create assessment result
-> mock pay event
-> activate subscription
-> return full protected result
```

## 校验边界证据

身高输入页显示：

```txt
Please, enter a value from 90 cm to 243 cm
```

前端 bundle 中还观察到类似常量：

```txt
age: 16-99
heightCm: 90-243
weightKg: 24.9-300
```

结论：

HealthGate 的边界校验不应只检查“是否为数字”，而应有产品级范围：

- 年龄：16 到 99。
- 身高：90cm 到 243cm。
- 当前体重：24.9kg 到 300kg。
- 目标体重：24.9kg 到 300kg，同时需要检查目标 BMI 和目标方向是否合理。
- 健康数据同意：提交身体数据前必须为 true。

这些边界应同时覆盖在：

- Zod/API 输入校验。
- 健康评估算法单元测试。
- API 集成测试。

## 重要反差：竞品行为与挑战要求不同

一个关键观察是：在我已经点击过多个中间问题后，恢复接口里的 `answers.required` 仍然大多为 null。

合理推断：

竞品为了转化体验，可能把很多中间答案先保存在前端状态里，到某个关键节点再整体提交 answers。这个策略适合商业 funnel，但不完全符合本次挑战。

挑战题明确要求：

- 分步保存。
- 中断后恢复。
- 乱序/重复提交。
- 并发更新。
- 状态一致性。

因此 HealthGate 应做得比竞品更“后端工程化”：

```txt
竞品倾向：转化优先，前端状态较重，关键节点批量提交。
HealthGate：工程质量优先，每步落库，可恢复，可冲突检测，可测试。
```

## 订阅前后用户能拿到什么

这部分需要诚实区分直接观察和合理推断：

- 直接观察：公开 questionnaire 响应包含 `paidOrder: null`、`paidUpsellOrders: []`，说明支付/订单状态与问卷答案分离。
- 直接观察：前端 bundle 中存在 `createOrderBulk`、`getOrderStatus`、`/questionnaires/:id/order/bulk`、`/orders/:id/status` 等支付/订单路径。
- 未观察：没有进入真实支付，也没有观察真实 paid result 页面。
- 合理推断：订阅/支付成功后，用户会从预览/购买页进入完整计划体验；挑战题明确要求我们模拟这个差异化返回。

| 阶段 | 用户/前端可获得的数据 | 证据等级 | HealthGate 设计 |
| --- | --- | --- | --- |
| 未完成问卷 | questionnaire id、当前页面状态、已填答案 | 高：URL order + restore API | `GET /api/sessions/:id` 返回进度和已保存答案 |
| 完成问卷但未支付 | 评估预览、购买引导；不应暴露完整计划 | 中：竞品有 order/payment flow，但未观察真实 paywall payload | `GET /result` 返回 BMI、分类、公开建议；隐藏目标日期、热量计划和预测曲线 |
| 支付/订阅成功 | 完整计划、预测图、详细建议 | 中：bundle 中有 order status；题目明确要求会员完整返回 | `/pay` 激活 subscription；结果接口返回完整字段 |
| 支付事件 | order/payment status 与 questionnaire 关联 | 高：`paidOrder` 字段和 order/status 路径 | `payment_events` 记录回调，`subscriptions` 表示当前权限 |

更合理的判断：

竞品的 `paidOrder` / `paidUpsellOrders` 更像订单状态线索，不应直接照搬成 HealthGate 的订阅模型。HealthGate 的 `subscriptions` 表是从挑战题的“订阅鉴权与权限保护”要求抽象出来的，`payment_events` 则用于证明 `/pay` 回调闭环和幂等性。

## 从调研导出的设计决策

| 设计点 | 竞品证据 | HealthGate 决策 |
| --- | --- | --- |
| 会话识别 | URL 使用 `order=<uuid>` | 使用 `quiz_session_id`，同时支持 cookie 和 README curl |
| 答案模型 | `answers.required` + `extra/contentAnswers` | 核心列 + `answers_json` |
| 计算字段 | age、heightCm、currentWeightKg、targetWeightKg 等 | 强校验后服务端计算并持久化 |
| 扩展字段 | 大量生活方式/饮食/动机问题 | 前端保留少量增强问题，后端存 JSON |
| 支付/订单状态 | `paidOrder` / `paidUpsellOrders` | 用 `payment_events` 记录模拟回调，用 `subscriptions` 表示权限 |
| 支付闭环 | order + status | `/pay` 模拟支付，幂等激活订阅 |
| 结果保护 | 付费后解锁完整体验 | 非会员脱敏，会员完整 |

## Evidence Appendix

| Evidence ID | Source | Observation | Confidence | Design Implication |
| --- | --- | --- | --- | --- |
| E1 | 可见页面流程 | 年龄段后进入正式 questionnaire，URL 带 `order=<uuid>` | High | 使用匿名 `quiz_session_id` 贯穿恢复、计算、支付 |
| E2 | 可见页面流程 | Funnel 先采目标、体型、习惯、动机，再到身高等健康数据 | High | 前端采用分步 funnel，不做短表单 |
| E3 | HTML 公开环境变量 | `API_WITH_PS_PATH` 指向独立 API host | High | 页面/API/domain/repository 分层 |
| E4 | 恢复接口响应 | `answers.required` 包含 age、heightCm、currentWeightKg、targetWeightKg 等 | High | 核心计算字段列化并强校验 |
| E5 | 恢复接口响应 | `answers.extra`、`contentAnswers` 与 required 分离 | High | 扩展答案存 JSON |
| E6 | 身高页 | 身高范围提示为 90cm 到 243cm，且出现健康数据 consent | High | API 和测试覆盖数值边界与 consent |
| E7 | 前端 bundle | 存在 questionnaire answers、order、order status 相关方法和路径 | Medium | 问卷、结果、支付/订阅分表建模 |
| E8 | 恢复行为 | 已点击多个中间问题后 `answers.required` 仍大多为 null | Medium | 竞品可能关键节点批量提交；HealthGate 按题目要求每步落库 |
| E9 | 支付字段 | questionnaire 响应有 `paidOrder`、`paidUpsellOrders` | High | 支付状态不混入 answers；HealthGate 独立建 payment/subscription |

## 不复制的部分

以下部分不建议在 3 天挑战中复制：

- 真实支付处理器。
- 复杂 upsell/downsell。
- 多语言和地区税费。
- 完整动态问卷 constructor。
- 真实医疗/营养诊断。
- 过长的商业转化问卷。

我们只保留能服务评分标准的核心：

- 专业 API。
- 稳定数据建模。
- 分步持久化和恢复。
- 服务端计算。
- 订阅鉴权。
- 自动化测试证明。
