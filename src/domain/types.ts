export const stepKeys = ["profile", "goal", "body", "activity", "habits"] as const;

export type StepKey = (typeof stepKeys)[number];

export type Gender = "female" | "male" | "non_binary" | "prefer_not_to_say";

export type GoalType =
  | "lose_weight"
  | "build_strength"
  | "improve_flexibility"
  | "reduce_stress"
  | "improve_posture";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type QuizSessionStatus = "draft" | "completed";
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
  exerciseFrequency: string;
  healthDataConsent: true;
}

export interface ProjectionPoint {
  week: number;
  date: string;
  weightKg: number;
}

export interface AssessmentResult {
  id?: string;
  sessionId?: string;
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
  caloriePlan: {
    dailyCalories: number;
    proteinGrams: number;
    hydrationLiters: number;
    activityLabel: string;
    note: string;
  };
  projectionCurve: ProjectionPoint[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QuizSessionRecord {
  id: string;
  userId?: string | null;
  flowTopic: string;
  status: QuizSessionStatus;
  version: number;
  currentStep?: string | null;
  completedSteps: string[];
  answersJson: Record<string, unknown>;
  gender?: Gender | null;
  goalType?: GoalType | null;
  age?: number | null;
  heightCm?: number | null;
  currentWeightKg?: number | null;
  targetWeightKg?: number | null;
  activityLevel?: ActivityLevel | null;
  exerciseFrequency?: string | null;
  bodyZones?: string[] | null;
  physicalLimitations?: string[] | null;
  healthDataConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResultResponse {
  access: "preview" | "full";
  subscriptionStatus: SubscriptionStatus;
  paywall?: {
    required: true;
    message: string;
  };
  result: Record<string, unknown>;
}
