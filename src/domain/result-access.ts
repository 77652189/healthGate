import type { AssessmentResult, ResultResponse, SubscriptionStatus } from "./types";

export function buildResultResponse(
  result: AssessmentResult,
  subscriptionStatus: SubscriptionStatus
): ResultResponse {
  const publicResult = {
    bmi: result.bmi,
    bmiCategory: result.bmiCategory,
    publicSummary: result.publicSummary,
    publicRecommendations: result.publicRecommendations
  };

  if (subscriptionStatus !== "active") {
    return {
      access: "preview",
      subscriptionStatus,
      paywall: {
        required: true,
        message: "订阅后可查看目标日期、每日摄入建议和完整预测曲线。"
      },
      result: publicResult
    };
  }

  return {
    access: "full",
    subscriptionStatus,
    result: {
      ...publicResult,
      bmr: result.bmr,
      tdee: result.tdee,
      recommendedCalories: result.recommendedCalories,
      goalDirection: result.goalDirection,
      weeklyDeltaKg: result.weeklyDeltaKg,
      targetDate: result.targetDate.toISOString(),
      caloriePlan: result.caloriePlan,
      projectionCurve: result.projectionCurve
    }
  };
}
