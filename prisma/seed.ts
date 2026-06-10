import { Prisma } from "@prisma/client";
import { calculateHealthAssessment, ALGORITHM_VERSION } from "../src/modules/assessment/algorithm";
import { toDbActivityLevel, toDbExerciseFrequency, toDbGender, toDbGoalDirection, toDbGoalType } from "../src/modules/quiz/mappers";
import type { AssessmentInput } from "../src/modules/quiz/types";
import { prisma } from "../src/shared/prisma";

const unpaidSessionId = "00000000-0000-4000-8000-000000000001";
const paidSessionId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000010";

const input: AssessmentInput = {
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

async function seedSession(sessionId: string, paid: boolean) {
  const result = calculateHealthAssessment(input, { now: new Date("2026-06-10T00:00:00.000Z") });

  await prisma.stepEvent.deleteMany({ where: { sessionId } });
  await prisma.paymentEvent.deleteMany({ where: { sessionId } });
  await prisma.subscription.deleteMany({ where: { sessionId } });
  await prisma.assessmentResult.deleteMany({ where: { sessionId } });

  await prisma.quizSession.upsert({
    where: { id: sessionId },
    update: {
      userId,
      status: "COMPLETED",
      version: 6,
      currentStep: "HABITS",
      completedSteps: ["profile", "goal", "body", "activity", "habits"],
      answersJson: {
        ageRange: "30_39",
        currentBodyShape: "mid_sized",
        desiredBodyShape: "toned",
        typicalDay: "active_breaks",
        sleepHours: "7_8",
        waterIntake: "medium",
        dietPreference: "traditional",
        physicalLimitationsAnswered: true
      },
      gender: toDbGender[input.gender],
      goalType: toDbGoalType[input.goalType],
      age: input.age,
      heightCm: input.heightCm,
      currentWeightKg: input.currentWeightKg,
      targetWeightKg: input.targetWeightKg,
      activityLevel: toDbActivityLevel[input.activityLevel],
      exerciseFrequency: toDbExerciseFrequency[input.exerciseFrequency],
      bodyZones: ["belly", "legs"],
      physicalLimitations: [],
      healthDataConsent: true,
      healthDataConsentAt: new Date("2026-06-10T00:00:00.000Z"),
      completedAt: new Date("2026-06-10T00:00:00.000Z")
    },
    create: {
      id: sessionId,
      userId,
      status: "COMPLETED",
      version: 6,
      currentStep: "HABITS",
      completedSteps: ["profile", "goal", "body", "activity", "habits"],
      answersJson: {
        ageRange: "30_39",
        currentBodyShape: "mid_sized",
        desiredBodyShape: "toned",
        typicalDay: "active_breaks",
        sleepHours: "7_8",
        waterIntake: "medium",
        dietPreference: "traditional",
        physicalLimitationsAnswered: true
      },
      gender: toDbGender[input.gender],
      goalType: toDbGoalType[input.goalType],
      age: input.age,
      heightCm: input.heightCm,
      currentWeightKg: input.currentWeightKg,
      targetWeightKg: input.targetWeightKg,
      activityLevel: toDbActivityLevel[input.activityLevel],
      exerciseFrequency: toDbExerciseFrequency[input.exerciseFrequency],
      bodyZones: ["belly", "legs"],
      physicalLimitations: [],
      healthDataConsent: true,
      healthDataConsentAt: new Date("2026-06-10T00:00:00.000Z"),
      completedAt: new Date("2026-06-10T00:00:00.000Z")
    }
  });

  await prisma.assessmentResult.create({
    data: {
      sessionId,
      sourceSessionVersion: 6,
      algorithmVersion: ALGORITHM_VERSION,
      status: "CURRENT",
      bmi: result.bmi,
      bmiCategory: result.bmiCategory,
      bmr: result.bmr,
      tdee: result.tdee,
      recommendedCalories: result.recommendedCalories,
      goalDirection: toDbGoalDirection[result.goalDirection],
      weeklyDeltaKg: result.weeklyDeltaKg,
      targetDate: result.targetDate,
      publicSummary: result.publicSummary,
      publicRecommendations: result.publicRecommendations as Prisma.InputJsonValue,
      caloriePlan: result.caloriePlan as Prisma.InputJsonValue,
      projectionCurve: result.projectionCurve as unknown as Prisma.InputJsonValue
    }
  });

  if (paid) {
    await prisma.paymentEvent.create({
      data: {
        sessionId,
        provider: "mock",
        idempotencyKey: "seed-paid-demo",
        status: "SUCCEEDED",
        payload: { source: "seed" }
      }
    });
    await prisma.subscription.create({
      data: {
        sessionId,
        status: "ACTIVE",
        activeFrom: new Date("2026-06-10T00:00:00.000Z")
      }
    });
  }
}

async function main() {
  await prisma.user.upsert({
    where: { id: userId },
    update: { anonymousKey: "demo-user" },
    create: { id: userId, anonymousKey: "demo-user" }
  });
  await seedSession(unpaidSessionId, false);
  await seedSession(paidSessionId, true);
  console.log(`UNPAID_DEMO_SESSION_ID=${unpaidSessionId}`);
  console.log(`PAID_DEMO_SESSION_ID=${paidSessionId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
