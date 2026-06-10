# API 设计

## 设计原则

- 使用 REST 风格资源路径。
- 所有写接口做 Zod 输入校验。
- 错误响应结构统一。
- 保存阶段允许乱序和重复提交。
- submit 阶段严格校验完整性。
- 结果接口做权限裁剪，非会员不能拿到受保护字段。
- `/pay` 是模拟支付回调，不接真实支付渠道，但要支持幂等。

## 统一错误结构

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload.",
    "details": []
  }
}
```

建议错误码：

| Code | HTTP | 含义 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | 输入格式错误或越界 |
| `NOT_FOUND` | 404 | session/result 不存在 |
| `VERSION_CONFLICT` | 409 | expectedVersion 与当前版本不一致 |
| `IDEMPOTENCY_CONFLICT` | 409 | idempotencyKey 已被不同请求使用 |
| `INCOMPLETE_SESSION` | 422 | submit 时核心字段不完整 |
| `RESULT_NOT_READY` | 409 | 还未生成评估结果 |
| `INTERNAL_ERROR` | 500 | 未预期错误 |

## 字段约束

### 枚举

| 字段 | 允许值 |
| --- | --- |
| `gender` | `female`, `male`, `non_binary`, `prefer_not_to_say` |
| `ageRange` | `18_29`, `30_39`, `40_49`, `50_plus` |
| `goalType` | `lose_weight`, `build_strength`, `improve_flexibility`, `reduce_stress`, `improve_posture` |
| `currentBodyShape` | `slim`, `mid_sized`, `plus_sized`, `significantly_overweight` |
| `desiredBodyShape` | `thin`, `toned`, `curvy`, `average` |
| `bodyZones[]` | `belly`, `butt`, `legs`, `chest`, `arms`, `back` |
| `activityLevel` | `sedentary`, `light`, `moderate`, `active`, `very_active` |
| `exerciseFrequency` | `never`, `monthly`, `1_2_week`, `3_4_week`, `daily` |
| `typicalDay` | `mostly_sitting`, `active_breaks`, `on_feet` |
| `sleepHours` | `under_5`, `5_6`, `7_8`, `over_8` |
| `waterIntake` | `low`, `medium`, `high` |
| `dietPreference` | `traditional`, `vegetarian`, `mediterranean`, `keto`, `none` |
| `payment.status` | `succeeded`, `failed` |

### 数值边界

| 字段 | 范围 | 说明 |
| --- | --- | --- |
| `age` | 16-99 | 精确年龄，用于算法 |
| `heightCm` | 90-243 | 参考竞品身高页范围 |
| `currentWeightKg` | 24.9-300 | 当前体重 |
| `targetWeightKg` | 24.9-300 | 目标体重 |
| `target BMI` | 18.5-40 | 由 `heightCm` 和 `targetWeightKg` 派生校验 |
| `bodyZones` | 1-6 项 | 防止空选择和过大 payload |
| `physicalLimitations` | 0-6 项 | 每项短字符串或枚举 |

### 目标体重规则

- `goalType=lose_weight` 时，`targetWeightKg` 必须小于 `currentWeightKg`。
- 目标体重不能导致 BMI 低于 18.5。
- 目标体重不能导致 BMI 高于 40。
- 非减重目标不允许一次性设置超过当前体重 35% 的变化。

## 路径与会话识别

- 除题面明确要求的 `POST /pay` 外，其余业务 API 使用 `/api/*`。
- 浏览器访问时优先使用 HttpOnly cookie `hg_session_id` 辅助恢复当前会话。
- README 和评审 cURL 必须支持显式 `sessionId`，不依赖 cookie。
- 当 path/body 中的显式 `sessionId` 与 cookie 不一致时，以显式 `sessionId` 为准，并刷新 cookie 到该 session，方便评审跨浏览器复现。
- `sessionId` 使用 UUID，第一版只作为匿名会话标识，不等同于强登录鉴权；受保护结果仍由 `subscriptions.status` 控制。

### StepKey

`PATCH /api/sessions/:sessionId/steps/:stepKey` 只接受以下 step：

| stepKey | 作用 |
| --- | --- |
| `profile` | 基础画像与前端文案节奏 |
| `goal` | 目标与关注区域 |
| `body` | 算法必需身体数据与健康数据同意 |
| `activity` | 活动强度与运动频率 |
| `habits` | 扩展生活习惯与限制 |

未知 stepKey 返回 `400 VALIDATION_ERROR`。每个 step 只接受自己声明的字段；跨 step 字段、未知字段、对象原型注入字段都返回 `400 VALIDATION_ERROR`。

保存阶段允许提交该 step 的非空字段子集，不要求一次提交完整 step。原因是前端会把 `goal` 和 `body` 拆成更细的视觉步骤：

- `goal` 可以先保存 `goalType`，再保存 `bodyZones` 和 `desiredBodyShape`。
- `body` 可以先保存年龄/身高/体重，再保存 `healthDataConsent`。

`completedSteps` 不按“是否调用过 PATCH”计算，而按该 step 的必需字段是否齐全计算。submit 阶段仍然做全量完整性校验。

step 完成字段：

| stepKey | 完成所需字段 | 是否参与算法 |
| --- | --- | --- |
| `profile` | `gender`, `ageRange`, `currentBodyShape` | `gender` 参与算法；其余用于展示 |
| `goal` | `goalType`, `bodyZones`, `desiredBodyShape` | `goalType` 参与算法；其余用于展示和结果解释 |
| `body` | `age`, `heightCm`, `currentWeightKg`, `targetWeightKg`, `healthDataConsent=true` | 全部参与 submit 校验 |
| `activity` | `activityLevel`, `exerciseFrequency`, `typicalDay` | 前两项参与算法；`typicalDay` 用于展示 |
| `habits` | `sleepHours`, `waterIntake`, `dietPreference`, `physicalLimitations` | 不参与第一版算法，但用于个性化解释 |

`physicalLimitations` 可以是空数组，但字段必须存在，避免前端无法区分“用户没有限制”和“还没回答”。

## 1. 创建测评会话

```txt
POST /api/sessions
```

请求：

```json
{
  "flowTopic": "healthgate_weight_management_v1",
  "resumeExisting": true
}
```

响应：

```json
{
  "sessionId": "uuid",
  "version": 1,
  "currentStep": "profile",
  "status": "draft"
}
```

说明：

- 如果浏览器没有 session cookie，则创建匿名 user 和 quiz session。
- 如果浏览器已有有效 `hg_session_id`，且 `resumeExisting=true`，则返回该 session，而不是重复创建。
- 如果用户明确要重新开始，可传 `resumeExisting=false` 创建新 session 并刷新 cookie。
- 响应中的 `sessionId` 也用于 README curl 演示。
- 成功后设置 `hg_session_id` cookie，前端刷新或再次进入时可直接恢复。

## 2. 恢复测评进度

```txt
GET /api/sessions/:sessionId
```

恢复接口要回答两个问题：

- 用户已经填到哪里。
- 哪些核心字段已经可用于最终计算。

响应按竞品调研中的 `required + extra/contentAnswers` 思路组织，但命名更贴合 HealthGate：

响应：

```json
{
  "session": {
    "id": "uuid",
    "status": "draft",
    "version": 4,
    "currentStep": "activity",
    "completedSteps": ["profile", "goal", "body"],
    "answers": {
      "required": {
        "gender": "female",
        "goalType": "lose_weight",
        "bodyZones": ["belly", "legs"],
        "age": 32,
        "heightCm": 168,
        "currentWeightKg": 74,
        "targetWeightKg": 65,
        "activityLevel": null,
        "exerciseFrequency": null,
        "healthDataConsent": true
      },
      "extra": {
        "currentBodyShape": "mid_sized",
        "desiredBodyShape": "toned",
        "sleepHours": "7_8",
        "dietPreference": "traditional"
      }
    }
  }
}
```

用途：

- 页面刷新后恢复。
- 用户关闭页面后再次进入。
- 评审通过 curl 检查状态。

## 3. 分步保存

```txt
PATCH /api/sessions/:sessionId/steps/:stepKey
```

请求：

```json
{
  "expectedVersion": 3,
  "answers": {
    "activityLevel": "moderate",
    "exerciseFrequency": "3_4_week"
  }
}
```

响应：

```json
{
  "sessionId": "uuid",
  "version": 4,
  "currentStep": "habits",
  "completedSteps": ["profile", "goal", "body", "activity"],
  "saved": {
    "stepKey": "activity"
  }
}
```

并发冲突：

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Session version is stale.",
    "details": {
      "currentVersion": 4,
      "expectedVersion": 3
    }
  }
}
```

保存行为：

- 允许乱序提交；`currentStep` 由固定 step 顺序中第一个未完成 step 计算得出。
- 允许重复提交；只要 `expectedVersion` 正确，就保存新 payload 并递增 version。
- 只要写入被接受，就记录 `step_events`，用于证明刷新、中断、重复提交和并发路径可追踪。
- 如果 session 已经 `COMPLETED`，并且用户修改了 `gender`、`goalType`、`bodyZones`、`age`、`heightCm`、`currentWeightKg`、`targetWeightKg`、`activityLevel`、`exerciseFrequency` 或 `healthDataConsent`，则 session 回到 `DRAFT`，当前 result 标记为 stale；重新 submit 前，结果接口返回 `409 RESULT_NOT_READY`。
- 如果只修改 `answersJson.extra` 中的展示型答案，不强制废弃 result，但仍递增 version 并记录事件。

### Step payload

这些 step 是 HealthGate 对竞品 funnel 的压缩版：保留关键数据流，不复制过长商业问卷。

#### profile

```json
{
  "gender": "female",
  "ageRange": "30_39",
  "currentBodyShape": "mid_sized"
}
```

持久化：

- `gender` 进入核心列。
- `ageRange` 和 `currentBodyShape` 进入 `answersJson.extra`，只用于前端节奏和文案。

#### goal

```json
{
  "goalType": "lose_weight",
  "bodyZones": ["belly", "legs"],
  "desiredBodyShape": "toned"
}
```

持久化：

- `goalType` 进入核心列。
- `bodyZones` 保存到 `quiz_sessions.bodyZones`，恢复响应中归入 `answers.required.bodyZones`。
- `desiredBodyShape` 进入 `answersJson.extra`。

#### body

```json
{
  "age": 32,
  "heightCm": 168,
  "currentWeightKg": 74,
  "targetWeightKg": 65,
  "healthDataConsent": true
}
```

持久化：

- 全部进入核心列。
- `healthDataConsent` 是 submit 前置条件。

#### activity

```json
{
  "activityLevel": "moderate",
  "exerciseFrequency": "3_4_week",
  "typicalDay": "active_breaks"
}
```

持久化：

- `activityLevel` 和 `exerciseFrequency` 进入核心列。
- `typicalDay` 进入 `answersJson.extra`。

#### habits

```json
{
  "sleepHours": "7_8",
  "waterIntake": "medium",
  "dietPreference": "traditional",
  "physicalLimitations": []
}
```

持久化：

- 进入 `answersJson.extra`。
- `physicalLimitations` 同时可保存到专门 JSON 列，用于结果页安全提示。

## 4. 提交并生成评估

```txt
POST /api/sessions/:sessionId/submit
```

请求：

```json
{
  "expectedVersion": 6
}
```

响应：

```json
{
  "sessionId": "uuid",
  "status": "completed",
  "resultId": "uuid",
  "algorithmVersion": "healthgate-basic-v1",
  "version": 6,
  "next": "/result?sessionId=uuid"
}
```

行为：

- 校验 `expectedVersion`，过期则返回 `409 VERSION_CONFLICT`。
- 读取 session 当前核心字段。
- 校验完整性和数值边界。
- 调用服务端算法。
- 持久化 `assessment_results`。
- 将 session 状态改为 `COMPLETED`。
- 将 `assessment_results.algorithmVersion` 与生成时的 session version 一起保存，保证以后算法升级后仍能解释历史结果。

幂等规则：

- 如果 session 已经是 `COMPLETED`，且当前 version 对应的 result 已存在，则重复 submit 返回已有 result。
- 如果核心字段在 completed 后被修改，session 回到 `DRAFT`，旧 result 不再作为当前结果返回，必须重新 submit。
- 如果 submit 过程中校验失败，不创建 result，session 状态保持 `DRAFT`。

如果字段不完整：

```json
{
  "error": {
    "code": "INCOMPLETE_SESSION",
    "message": "Cannot submit until required fields are complete.",
    "details": ["activityLevel", "exerciseFrequency"]
  }
}
```

## 5. 获取结果

```txt
GET /api/sessions/:sessionId/result
```

结果接口的核心要求是字段级权限裁剪，而不是简单页面遮罩。

非会员响应：

```json
{
  "access": "preview",
  "subscriptionStatus": "none",
  "resultId": "uuid",
  "algorithmVersion": "healthgate-basic-v1",
  "result": {
    "bmi": 26.2,
    "bmiCategory": "overweight",
    "publicSummary": "当前 BMI 为 26.2...",
    "publicRecommendations": [
      "优先保持稳定运动频率，而不是短期极端调整。"
    ]
  },
  "paywall": {
    "required": true,
    "message": "订阅后可查看完整计划。",
    "ctaLabel": "解锁完整计划",
    "features": [
      "目标日期与趋势",
      "每日摄入建议",
      "个性化饮食与运动计划"
    ]
  }
}
```

会员响应：

```json
{
  "access": "full",
  "subscriptionStatus": "active",
  "resultId": "uuid",
  "algorithmVersion": "healthgate-basic-v1",
  "result": {
    "bmi": 26.2,
    "bmiCategory": "overweight",
    "publicSummary": "当前 BMI 为 26.2...",
    "publicRecommendations": [
      "优先保持稳定运动频率，而不是短期极端调整。"
    ],
    "bmr": 1450,
    "tdee": 2248,
    "recommendedCalories": 1748,
    "goalDirection": "loss",
    "weeklyDeltaKg": 0.5,
    "targetDate": "2026-10-14T00:00:00.000Z",
    "caloriePlan": {
      "dailyCalories": 1748,
      "proteinGrams": 104,
      "hydrationLiters": 2.1
    },
    "projectionCurve": [
      {
        "week": 0,
        "date": "2026-06-10",
        "weightKg": 74
      }
    ]
  }
}
```

安全要求：

非会员响应必须不包含：

- `bmr`
- `tdee`
- `recommendedCalories`
- `goalDirection`
- `weeklyDeltaKg`
- `targetDate`
- `caloriePlan`
- `projectionCurve`

会员响应才返回这些字段。

会员响应应是 preview 的超集：保留 `bmi`、`bmiCategory`、`publicSummary`、`publicRecommendations`，再追加受保护字段。这样支付后结果页不会丢失公开摘要。

设计理由：

- 竞品调研显示支付/订单状态与 questionnaire 分离。
- 本项目用 `subscriptions.status` 作为结果访问控制来源。
- 非会员响应中不出现受保护字段名，避免前端误用或字段泄漏。
- `paywall.features` 只能使用用户可读文案，不能使用 `targetDate`、`projectionCurve`、`recommendedCalories` 等原始字段 key，也不能包含这些字段的具体数值。

异常路径：

- session 不存在返回 `404 NOT_FOUND`。
- session 存在但没有当前有效 result，返回 `409 RESULT_NOT_READY`。
- 如果 result 已 stale，必须先重新 submit，不能返回旧 full result。

## 6. 模拟支付

```txt
POST /pay
```

说明：

- 题面明确要求 `/pay` 接口，因此主接口使用 `POST /pay`。
- 可选实现 `POST /api/pay` 作为兼容别名，但 README 和评审 cURL 使用 `/pay`。

请求：

```json
{
  "sessionId": "uuid",
  "idempotencyKey": "demo-payment-001",
  "status": "succeeded"
}
```

响应：

```json
{
  "sessionId": "uuid",
  "subscriptionStatus": "active",
  "paymentEventId": "uuid"
}
```

行为：

- 创建 `payment_events`。
- 如果 `status=succeeded`，则 upsert `subscriptions` 为 `ACTIVE`。
- 如果 `status=failed`，则只记录 failed event，返回当前订阅状态，不激活会员。
- 支付成功不修改 answers，也不重新计算 result；它只改变访问权限。
- `/pay` 不要求 result 已生成；如果先支付后 submit，submit 后结果接口会直接返回 full。

幂等规则：

| 场景 | 响应 |
| --- | --- |
| 新 idempotencyKey + succeeded | 创建 succeeded event，激活 subscription |
| 新 idempotencyKey + failed | 创建 failed event，不激活 subscription |
| 同 idempotencyKey + 同 session + 同 status | 返回已有 payment event |
| 同 idempotencyKey + 不同 session 或不同 status | `409 IDEMPOTENCY_CONFLICT` |

失败模拟：

```json
{
  "sessionId": "uuid",
  "idempotencyKey": "demo-payment-failed-001",
  "status": "failed"
}
```

失败支付不激活订阅。

## 7. 健康检查

```txt
GET /api/health
```

响应：

```json
{
  "ok": true,
  "service": "healthgate",
  "timestamp": "2026-06-10T00:00:00.000Z"
}
```

用于部署后快速验证服务在线。

## cURL 演示草案

README 中最终提供完整可重放脚本：

```bash
curl -X POST "$BASE_URL/api/sessions" \
  -H "Content-Type: application/json" \
  -d '{"flowTopic":"healthgate_weight_management_v1","resumeExisting":true}'

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
  -d '{"sessionId":"'$SESSION_ID'","idempotencyKey":"demo-payment-001","status":"succeeded"}'

curl "$BASE_URL/api/sessions/$SESSION_ID/result"
```
