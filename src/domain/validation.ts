import { z } from "zod";
import type { AssessmentInput, StepKey } from "./types";

export const genderSchema = z.enum(["female", "male", "non_binary", "prefer_not_to_say"]);

export const goalTypeSchema = z.enum([
  "lose_weight",
  "build_strength",
  "improve_flexibility",
  "reduce_stress",
  "improve_posture"
]);

export const activityLevelSchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);

const boundedString = z.string().trim().min(1).max(80);
const boundedStringArray = z.array(boundedString).min(1).max(8);

export const profileStepSchema = z
  .object({
    gender: genderSchema
  })
  .strict();

export const goalStepSchema = z
  .object({
    goalType: goalTypeSchema,
    bodyZones: boundedStringArray.default(["core"])
  })
  .strict();

export const bodyStepSchema = z
  .object({
    age: z.number().int().min(16).max(99),
    heightCm: z.number().min(90).max(243),
    currentWeightKg: z.number().min(24.9).max(300),
    targetWeightKg: z.number().min(24.9).max(300),
    healthDataConsent: z.literal(true)
  })
  .strict();

export const activityStepSchema = z
  .object({
    activityLevel: activityLevelSchema,
    exerciseFrequency: z.enum(["never", "monthly", "1_2_week", "3_4_week", "daily"])
  })
  .strict();

export const habitsStepSchema = z
  .object({
    sleepHours: z.enum(["under_5", "5_6", "7_8", "over_8"]),
    waterIntake: z.enum(["low", "medium", "high"]),
    dietPreference: z.enum(["traditional", "vegetarian", "mediterranean", "keto", "none"]),
    physicalLimitations: z.array(boundedString).max(6).default([])
  })
  .strict();

export const stepSchemas = {
  profile: profileStepSchema,
  goal: goalStepSchema,
  body: bodyStepSchema,
  activity: activityStepSchema,
  habits: habitsStepSchema
} as const;

export function parseStepPayload(stepKey: StepKey, payload: unknown) {
  return stepSchemas[stepKey].parse(payload);
}

export const assessmentInputSchema = z
  .object({
    gender: genderSchema,
    goalType: goalTypeSchema,
    age: z.number().int().min(16).max(99),
    heightCm: z.number().min(90).max(243),
    currentWeightKg: z.number().min(24.9).max(300),
    targetWeightKg: z.number().min(24.9).max(300),
    activityLevel: activityLevelSchema,
    exerciseFrequency: z.string().min(1).max(40),
    healthDataConsent: z.literal(true)
  })
  .strict()
  .superRefine((value, ctx) => {
    const heightM = value.heightCm / 100;
    const targetBmi = value.targetWeightKg / heightM ** 2;
    const weightDelta = value.targetWeightKg - value.currentWeightKg;

    if (targetBmi < 18.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Target weight would be below the healthy BMI range."
      });
    }

    if (targetBmi > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Target weight is outside the supported planning range."
      });
    }

    if (value.goalType === "lose_weight" && weightDelta >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "A weight-loss goal requires a target weight below current weight."
      });
    }

    if (value.goalType !== "lose_weight" && Math.abs(weightDelta) / value.currentWeightKg > 0.35) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Target weight change is too large for this goal type."
      });
    }

    if (value.goalType === "lose_weight" && value.targetWeightKg < value.currentWeightKg * 0.65) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetWeightKg"],
        message: "Target weight loss exceeds the supported safe planning range."
      });
    }
  });

export function parseAssessmentInput(input: unknown): AssessmentInput {
  return assessmentInputSchema.parse(input);
}
