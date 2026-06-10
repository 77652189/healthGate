import { z } from "zod";
import { AppError } from "../../shared/errors";
import { assertNoDangerousKeys } from "../../shared/json";
import {
  activityLevelValues,
  exerciseFrequencyValues,
  genderValues,
  goalTypeValues,
  stepKeys,
  type StepKey
} from "./types";

const finiteNumber = z.number().finite();
const boundedString = z.string().trim().min(1).max(80);
const optionalDisplayString = z.string().trim().min(1).max(80);

export const stepKeySchema = z.enum(stepKeys);
export const genderSchema = z.enum(genderValues);
export const goalTypeSchema = z.enum(goalTypeValues);
export const activityLevelSchema = z.enum(activityLevelValues);
export const exerciseFrequencySchema = z.enum(exerciseFrequencyValues);

export const createSessionSchema = z
  .object({
    flowTopic: z.string().trim().min(1).max(120).default("healthgate_weight_management_v1"),
    resumeExisting: z.boolean().default(true)
  })
  .strict();

export const submitSessionSchema = z
  .object({
    expectedVersion: z.number().int().positive()
  })
  .strict();

const profileAnswersSchema = z
  .object({
    gender: genderSchema.optional(),
    ageRange: z.enum(["16_29", "30_39", "40_49", "50_plus"]).optional(),
    currentBodyShape: optionalDisplayString.optional()
  })
  .strict();

const goalAnswersSchema = z
  .object({
    goalType: goalTypeSchema.optional(),
    bodyZones: z
      .array(z.enum(["belly", "butt", "legs", "chest", "arms", "back"]))
      .min(1)
      .max(6)
      .optional(),
    desiredBodyShape: optionalDisplayString.optional()
  })
  .strict();

const bodyAnswersSchema = z
  .object({
    age: z.number().int().min(16).max(99).optional(),
    heightCm: finiteNumber.min(90).max(243).optional(),
    currentWeightKg: finiteNumber.min(24.9).max(300).optional(),
    targetWeightKg: finiteNumber.min(24.9).max(300).optional(),
    healthDataConsent: z.literal(true).optional()
  })
  .strict();

const activityAnswersSchema = z
  .object({
    activityLevel: activityLevelSchema.optional(),
    exerciseFrequency: exerciseFrequencySchema.optional(),
    typicalDay: z.enum(["mostly_sitting", "active_breaks", "standing", "physical_work"]).optional()
  })
  .strict();

const habitsAnswersSchema = z
  .object({
    sleepHours: z.enum(["under_5", "5_6", "7_8", "over_8"]).optional(),
    waterIntake: z.enum(["low", "medium", "high"]).optional(),
    dietPreference: z.enum(["traditional", "vegetarian", "mediterranean", "keto", "none"]).optional(),
    physicalLimitations: z.array(boundedString).max(6).optional()
  })
  .strict();

export const stepAnswerSchemas = {
  profile: profileAnswersSchema,
  goal: goalAnswersSchema,
  body: bodyAnswersSchema,
  activity: activityAnswersSchema,
  habits: habitsAnswersSchema
} as const;

export type StepAnswers = {
  [K in StepKey]: z.infer<(typeof stepAnswerSchemas)[K]>;
};

function assertSafePayload(payload: unknown) {
  try {
    assertNoDangerousKeys(payload);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", {
      details: [error instanceof Error ? error.message : "dangerous key"]
    });
  }
}

function ensureNonEmptyAnswers(answers: Record<string, unknown>) {
  if (Object.keys(answers).length === 0) {
    throw new AppError("VALIDATION_ERROR", { details: ["answers must contain at least one field"] });
  }
}

export function parseCreateSessionPayload(payload: unknown) {
  assertSafePayload(payload);
  return createSessionSchema.parse(payload ?? {});
}

export function parseSubmitPayload(payload: unknown) {
  assertSafePayload(payload);
  return submitSessionSchema.parse(payload);
}

export function parseStepPatchPayload(stepKey: StepKey, payload: unknown) {
  assertSafePayload(payload);
  const base = z
    .object({
      expectedVersion: z.number().int().positive(),
      answers: z.unknown()
    })
    .strict()
    .parse(payload);
  const answers = stepAnswerSchemas[stepKey].parse(base.answers);
  ensureNonEmptyAnswers(answers);
  return {
    expectedVersion: base.expectedVersion,
    answers: answers as StepAnswers[typeof stepKey]
  };
}

