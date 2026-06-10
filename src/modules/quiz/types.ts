export const stepKeys = ["profile", "goal", "body", "activity", "habits"] as const;
export type StepKey = (typeof stepKeys)[number];

export const genderValues = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
export type Gender = (typeof genderValues)[number];

export const goalTypeValues = [
  "lose_weight",
  "build_strength",
  "improve_flexibility",
  "reduce_stress",
  "improve_posture"
] as const;
export type GoalType = (typeof goalTypeValues)[number];

export const activityLevelValues = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof activityLevelValues)[number];

export const exerciseFrequencyValues = ["never", "monthly", "1_2_week", "3_4_week", "daily"] as const;
export type ExerciseFrequency = (typeof exerciseFrequencyValues)[number];

export type SubscriptionStatus = "none" | "active" | "expired" | "canceled";
export type GoalDirection = "loss" | "gain" | "maintain";

export interface AssessmentInput {
  gender: Gender;
  goalType: GoalType;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  exerciseFrequency: ExerciseFrequency;
  healthDataConsent: true;
}

export interface ProjectionPoint {
  week: number;
  date: string;
  weightKg: number;
}

export interface AssessmentResultData {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  goalDirection: GoalDirection;
  weeklyDeltaKg: number;
  targetDate: Date;
  publicSummary: string;
  publicRecommendations: string[];
  caloriePlan: Record<string, unknown>;
  projectionCurve: ProjectionPoint[];
}

