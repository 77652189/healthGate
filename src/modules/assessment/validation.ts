import { z } from "zod";
import { activityLevelSchema, exerciseFrequencySchema, genderSchema, goalTypeSchema } from "../quiz/schemas";
import type { AssessmentInput } from "../quiz/types";

export const assessmentInputSchema = z
  .object({
    gender: genderSchema,
    goalType: goalTypeSchema,
    age: z.number().int().min(16).max(99),
    heightCm: z.number().finite().min(90).max(243),
    currentWeightKg: z.number().finite().min(24.9).max(300),
    targetWeightKg: z.number().finite().min(24.9).max(300),
    activityLevel: activityLevelSchema,
    exerciseFrequency: exerciseFrequencySchema,
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

