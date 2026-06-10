import { parseAssessmentInput } from "./validation";
import type { ActivityLevel, AssessmentInput, AssessmentResultData, Gender, GoalDirection } from "../quiz/types";

export const ALGORITHM_VERSION = "healthgate-basic-v1";

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
};

const activityLabels: Record<ActivityLevel, string> = {
  sedentary: "低活动量",
  light: "轻度活动",
  moderate: "中等活动",
  active: "高活动量",
  very_active: "非常活跃"
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function classifyBmi(bmi: number) {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function genderOffset(gender: Gender) {
  if (gender === "male") return 5;
  if (gender === "female") return -161;
  return -78;
}

function minimumCalories(gender: Gender) {
  if (gender === "male") return 1500;
  if (gender === "female") return 1200;
  return 1350;
}

function goalDirection(currentWeightKg: number, targetWeightKg: number): GoalDirection {
  if (targetWeightKg < currentWeightKg) return "loss";
  if (targetWeightKg > currentWeightKg) return "gain";
  return "maintain";
}

function weeklyDeltaFor(direction: GoalDirection) {
  if (direction === "loss") return 0.5;
  if (direction === "gain") return 0.25;
  return 0;
}

function buildProjectionCurve(input: AssessmentInput, direction: GoalDirection, weeklyDeltaKg: number, now: Date) {
  if (direction === "maintain") {
    return [{ week: 0, date: isoDate(now), weightKg: round(input.currentWeightKg) }];
  }

  const totalDelta = Math.abs(input.targetWeightKg - input.currentWeightKg);
  const totalWeeks = Math.max(1, Math.ceil(totalDelta / weeklyDeltaKg));
  const cappedWeeks = Math.min(totalWeeks, 52);
  const sign = direction === "loss" ? -1 : 1;

  const points = [];
  for (let week = 0; week <= cappedWeeks; week += 1) {
    const rawWeight = input.currentWeightKg + sign * Math.min(totalDelta, weeklyDeltaKg * week);
    points.push({
      week,
      date: isoDate(addDays(now, week * 7)),
      weightKg: round(rawWeight)
    });
  }

  if (points[points.length - 1]?.weightKg !== round(input.targetWeightKg)) {
    points.push({
      week: totalWeeks,
      date: isoDate(addDays(now, totalWeeks * 7)),
      weightKg: round(input.targetWeightKg)
    });
  }

  return points;
}

export function calculateHealthAssessment(
  rawInput: AssessmentInput,
  options: { now?: Date } = {}
): AssessmentResultData {
  const input = parseAssessmentInput(rawInput);
  const now = options.now ?? new Date();
  const heightM = input.heightCm / 100;
  const bmi = input.currentWeightKg / heightM ** 2;
  const bmr = 10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * input.age + genderOffset(input.gender);
  const tdee = bmr * activityFactors[input.activityLevel];
  const direction = goalDirection(input.currentWeightKg, input.targetWeightKg);
  const weeklyDeltaKg = weeklyDeltaFor(direction);
  const totalDeltaKg = Math.abs(input.targetWeightKg - input.currentWeightKg);
  const targetWeeks = weeklyDeltaKg === 0 ? 0 : Math.max(1, Math.ceil(totalDeltaKg / weeklyDeltaKg));
  const targetDate = addDays(now, targetWeeks * 7);
  const recommendedCalories =
    direction === "loss"
      ? Math.max(minimumCalories(input.gender), Math.round(tdee - 500))
      : direction === "gain"
        ? Math.round(tdee + 250)
        : Math.round(tdee);

  const bmiCategory = classifyBmi(bmi);
  const projectionCurve = buildProjectionCurve(input, direction, weeklyDeltaKg, now);
  const directionText = direction === "loss" ? "减重" : direction === "gain" ? "增重" : "维持";

  return {
    bmi: round(bmi),
    bmiCategory,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    recommendedCalories,
    goalDirection: direction,
    weeklyDeltaKg,
    targetDate,
    publicSummary: `当前 BMI 为 ${round(bmi)}，属于 ${bmiCategory} 区间。系统已生成 ${directionText}节奏建议。`,
    publicRecommendations: [
      "优先保持稳定运动频率，而不是短期极端调整。",
      "每周复盘一次体重和围度，比每天波动更有参考价值。"
    ],
    caloriePlan: {
      dailyCalories: recommendedCalories,
      proteinGrams: Math.round(input.targetWeightKg * 1.6),
      hydrationLiters: input.activityLevel === "active" || input.activityLevel === "very_active" ? 2.6 : 2.1,
      activityLabel: activityLabels[input.activityLevel],
      note: "该计划用于产品演示，不构成医学诊断或治疗建议。"
    },
    projectionCurve
  };
}

