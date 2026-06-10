import { describe, expect, it } from "vitest";
import { parseAssessmentInput } from "../validation";
import { parseStepPatchPayload } from "../../quiz/schemas";

const validInput = {
  gender: "female",
  goalType: "lose_weight",
  age: 32,
  heightCm: 168,
  currentWeightKg: 74,
  targetWeightKg: 65,
  activityLevel: "moderate",
  exerciseFrequency: "3_4_week",
  healthDataConsent: true
};

describe("assessment validation", () => {
  it("accepts explicit numeric boundaries", () => {
    expect(() =>
      parseAssessmentInput({ ...validInput, age: 16, heightCm: 90, currentWeightKg: 30, targetWeightKg: 24.9 })
    ).not.toThrow();
    expect(() =>
      parseAssessmentInput({ ...validInput, age: 99, heightCm: 243, currentWeightKg: 300, targetWeightKg: 230 })
    ).not.toThrow();
  });

  it("rejects out-of-range and missing health consent", () => {
    expect(() => parseAssessmentInput({ ...validInput, age: 15 })).toThrow();
    expect(() => parseAssessmentInput({ ...validInput, heightCm: 244 })).toThrow();
    expect(() => parseAssessmentInput({ ...validInput, currentWeightKg: 24 })).toThrow();
    expect(() => parseAssessmentInput({ ...validInput, healthDataConsent: false })).toThrow();
  });

  it("rejects string numbers, NaN and Infinity", () => {
    expect(() => parseAssessmentInput({ ...validInput, heightCm: "168" })).toThrow();
    expect(() => parseAssessmentInput({ ...validInput, heightCm: Number.NaN })).toThrow();
    expect(() => parseAssessmentInput({ ...validInput, heightCm: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("rejects unknown fields, cross-step fields and dangerous keys", () => {
    expect(() =>
      parseStepPatchPayload("profile", { expectedVersion: 1, answers: { gender: "female", heightCm: 168 } })
    ).toThrow();
    expect(() =>
      parseStepPatchPayload("profile", { expectedVersion: 1, answers: { gender: "female", unknown: true } })
    ).toThrow();
    expect(() =>
      parseStepPatchPayload(
        "profile",
        JSON.parse('{"expectedVersion":1,"answers":{"gender":"female","__proto__":{"polluted":true}}}')
      )
    ).toThrow();
  });

  it("rejects illegal enum values and long arrays", () => {
    expect(() =>
      parseStepPatchPayload("activity", { expectedVersion: 1, answers: { activityLevel: "super_active" } })
    ).toThrow();
    expect(() =>
      parseStepPatchPayload("goal", {
        expectedVersion: 1,
        answers: { bodyZones: ["belly", "butt", "legs", "chest", "arms", "back", "neck"] }
      })
    ).toThrow();
  });
});
