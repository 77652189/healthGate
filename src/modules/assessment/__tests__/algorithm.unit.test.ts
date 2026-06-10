import { describe, expect, it } from "vitest";
import { calculateHealthAssessment } from "../algorithm";

const baseInput = {
  gender: "female" as const,
  goalType: "lose_weight" as const,
  age: 32,
  heightCm: 168,
  currentWeightKg: 74,
  targetWeightKg: 65,
  activityLevel: "moderate" as const,
  exerciseFrequency: "3_4_week" as const,
  healthDataConsent: true as const
};

describe("calculateHealthAssessment", () => {
  it("calculates BMI, calories and target date for a normal weight-loss goal", () => {
    const result = calculateHealthAssessment(baseInput, { now: new Date("2026-06-10T00:00:00.000Z") });

    expect(result.bmi).toBeCloseTo(26.2, 1);
    expect(result.bmr).toBeGreaterThan(1300);
    expect(result.tdee).toBeGreaterThan(result.bmr);
    expect(result.recommendedCalories).toBeGreaterThanOrEqual(1200);
    expect(result.goalDirection).toBe("loss");
    expect(result.targetDate.toISOString().slice(0, 10)).toBe("2026-10-14");
    expect(result.projectionCurve[0]).toMatchObject({ week: 0, weightKg: 74 });
    expect(result.projectionCurve.at(-1)?.weightKg).toBe(65);
  });

  it("supports maintain and gain directions", () => {
    const maintain = calculateHealthAssessment({ ...baseInput, goalType: "build_strength", targetWeightKg: 74 });
    const gain = calculateHealthAssessment({ ...baseInput, goalType: "build_strength", targetWeightKg: 78 });

    expect(maintain.goalDirection).toBe("maintain");
    expect(gain.goalDirection).toBe("gain");
    expect(gain.recommendedCalories).toBeGreaterThan(gain.tdee);
  });

  it("rejects unreasonable target weight for weight loss", () => {
    expect(() => calculateHealthAssessment({ ...baseInput, targetWeightKg: 80 })).toThrow();
  });
});

