import { describe, expect, it } from "vitest";
import { buildResultResponse, containsProtectedField } from "../result-access";

const result = {
  bmi: 26.2,
  bmiCategory: "overweight",
  bmr: 1420,
  tdee: 2200,
  recommendedCalories: 1700,
  goalDirection: "loss",
  weeklyDeltaKg: 0.5,
  targetDate: new Date("2026-10-14T00:00:00.000Z"),
  publicSummary: "summary",
  publicRecommendations: ["recommendation"],
  caloriePlan: { dailyCalories: 1700 },
  projectionCurve: [{ week: 0, weightKg: 74 }]
};

describe("result access", () => {
  it("removes protected fields from preview response", () => {
    const response = buildResultResponse(result, "none");

    expect(response.access).toBe("preview");
    expect(containsProtectedField(response)).toBe(false);
    expect(JSON.stringify(response)).not.toContain("1700");
  });

  it("returns full result for active subscription", () => {
    const response = buildResultResponse(result, "active");

    expect(response.access).toBe("full");
    expect(containsProtectedField(response)).toBe(true);
    expect(response.result).toMatchObject({ recommendedCalories: 1700 });
  });
});

