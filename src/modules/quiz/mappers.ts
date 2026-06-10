import {
  ActivityLevel as DbActivityLevel,
  ExerciseFrequency as DbExerciseFrequency,
  Gender as DbGender,
  GoalDirection as DbGoalDirection,
  GoalType as DbGoalType,
  PaymentEventStatus,
  QuizSessionStatus,
  QuizStepKey,
  SubscriptionStatus as DbSubscriptionStatus
} from "@prisma/client";
import type {
  ActivityLevel,
  ExerciseFrequency,
  Gender,
  GoalDirection,
  GoalType,
  StepKey,
  SubscriptionStatus
} from "./types";

export const toDbStepKey: Record<StepKey, QuizStepKey> = {
  profile: QuizStepKey.PROFILE,
  goal: QuizStepKey.GOAL,
  body: QuizStepKey.BODY,
  activity: QuizStepKey.ACTIVITY,
  habits: QuizStepKey.HABITS
};

export const fromDbStepKey: Record<QuizStepKey, StepKey> = {
  PROFILE: "profile",
  GOAL: "goal",
  BODY: "body",
  ACTIVITY: "activity",
  HABITS: "habits"
};

export const toDbGender: Record<Gender, DbGender> = {
  female: DbGender.FEMALE,
  male: DbGender.MALE,
  non_binary: DbGender.NON_BINARY,
  prefer_not_to_say: DbGender.PREFER_NOT_TO_SAY
};

export const fromDbGender: Record<DbGender, Gender> = {
  FEMALE: "female",
  MALE: "male",
  NON_BINARY: "non_binary",
  PREFER_NOT_TO_SAY: "prefer_not_to_say"
};

export const toDbGoalType: Record<GoalType, DbGoalType> = {
  lose_weight: DbGoalType.LOSE_WEIGHT,
  build_strength: DbGoalType.BUILD_STRENGTH,
  improve_flexibility: DbGoalType.IMPROVE_FLEXIBILITY,
  reduce_stress: DbGoalType.REDUCE_STRESS,
  improve_posture: DbGoalType.IMPROVE_POSTURE
};

export const fromDbGoalType: Record<DbGoalType, GoalType> = {
  LOSE_WEIGHT: "lose_weight",
  BUILD_STRENGTH: "build_strength",
  IMPROVE_FLEXIBILITY: "improve_flexibility",
  REDUCE_STRESS: "reduce_stress",
  IMPROVE_POSTURE: "improve_posture"
};

export const toDbActivityLevel: Record<ActivityLevel, DbActivityLevel> = {
  sedentary: DbActivityLevel.SEDENTARY,
  light: DbActivityLevel.LIGHT,
  moderate: DbActivityLevel.MODERATE,
  active: DbActivityLevel.ACTIVE,
  very_active: DbActivityLevel.VERY_ACTIVE
};

export const fromDbActivityLevel: Record<DbActivityLevel, ActivityLevel> = {
  SEDENTARY: "sedentary",
  LIGHT: "light",
  MODERATE: "moderate",
  ACTIVE: "active",
  VERY_ACTIVE: "very_active"
};

export const toDbExerciseFrequency: Record<ExerciseFrequency, DbExerciseFrequency> = {
  never: DbExerciseFrequency.NEVER,
  monthly: DbExerciseFrequency.MONTHLY,
  "1_2_week": DbExerciseFrequency.ONE_TWO_WEEK,
  "3_4_week": DbExerciseFrequency.THREE_FOUR_WEEK,
  daily: DbExerciseFrequency.DAILY
};

export const fromDbExerciseFrequency: Record<DbExerciseFrequency, ExerciseFrequency> = {
  NEVER: "never",
  MONTHLY: "monthly",
  ONE_TWO_WEEK: "1_2_week",
  THREE_FOUR_WEEK: "3_4_week",
  DAILY: "daily"
};

export const toDbGoalDirection: Record<GoalDirection, DbGoalDirection> = {
  loss: DbGoalDirection.LOSS,
  maintain: DbGoalDirection.MAINTAIN,
  gain: DbGoalDirection.GAIN
};

export const fromDbGoalDirection: Record<DbGoalDirection, GoalDirection> = {
  LOSS: "loss",
  MAINTAIN: "maintain",
  GAIN: "gain"
};

export const fromDbSessionStatus: Record<QuizSessionStatus, "draft" | "completed"> = {
  DRAFT: "draft",
  COMPLETED: "completed"
};

export const toPaymentEventStatus = {
  succeeded: PaymentEventStatus.SUCCEEDED,
  failed: PaymentEventStatus.FAILED
} as const;

export const fromPaymentEventStatus = {
  SUCCEEDED: "succeeded",
  FAILED: "failed"
} as const;

export function fromDbSubscriptionStatus(status: DbSubscriptionStatus | null | undefined): SubscriptionStatus {
  if (!status) return "none";
  if (status === DbSubscriptionStatus.ACTIVE) return "active";
  if (status === DbSubscriptionStatus.EXPIRED) return "expired";
  return "canceled";
}

