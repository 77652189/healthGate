import type { SubscriptionStatus } from "../quiz/types";

export const protectedResultFields = [
  "bmr",
  "tdee",
  "recommendedCalories",
  "goalDirection",
  "weeklyDeltaKg",
  "targetDate",
  "caloriePlan",
  "projectionCurve"
] as const;

export type ProtectedResultField = (typeof protectedResultFields)[number];

export interface StoredResultLike {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  goalDirection: string;
  weeklyDeltaKg: number;
  targetDate: Date;
  publicSummary: string;
  publicRecommendations: unknown;
  caloriePlan: unknown;
  projectionCurve: unknown;
}

export function buildResultResponse(result: StoredResultLike, subscriptionStatus: SubscriptionStatus) {
  const publicResult = {
    bmi: result.bmi,
    bmiCategory: result.bmiCategory,
    publicSummary: result.publicSummary,
    publicRecommendations: result.publicRecommendations
  };

  if (subscriptionStatus !== "active") {
    return {
      access: "preview" as const,
      subscriptionStatus,
      paywall: {
        required: true as const,
        message: "订阅后可查看完整计划、目标日期和趋势图。"
      },
      result: publicResult
    };
  }

  return {
    access: "full" as const,
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

export function containsProtectedField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => containsProtectedField(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      protectedResultFields.includes(key as ProtectedResultField) || containsProtectedField(child)
  );
}

