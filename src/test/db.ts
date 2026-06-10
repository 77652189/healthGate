import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { prisma } from "../shared/prisma";
import { saveStep, createOrResumeSession } from "../modules/quiz/service";
import { submitAssessment } from "../modules/assessment/service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasDatabase = Boolean(databaseUrl);
const looksLikeTestDatabase = /test|localhost|127\.0\.0\.1/.test(databaseUrl) && !/supabase\.co/i.test(databaseUrl);

export const describeIntegration = hasDatabase ? describe : describe.skip;

export async function resetDatabase() {
  if (!looksLikeTestDatabase) {
    throw new Error("Refusing to run integration tests against a non-test database.");
  }
  await prisma.paymentEvent.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.stepEvent.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.quizSession.deleteMany();
  await prisma.user.deleteMany();
}

export function setupIntegrationDb() {
  beforeAll(async () => {
    if (!hasDatabase) return;
    await prisma.$connect();
  });

  beforeEach(async () => {
    if (!hasDatabase) return;
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}

export async function createCompleteDraftSession() {
  const created = await createOrResumeSession({
    flowTopic: "healthgate_weight_management_v1",
    resumeExisting: false
  });

  let current = await saveStep(created.sessionId, "profile", {
    expectedVersion: created.version,
    answers: { gender: "female", ageRange: "30_39", currentBodyShape: "mid_sized" }
  });
  current = await saveStep(created.sessionId, "goal", {
    expectedVersion: current.version,
    answers: { goalType: "lose_weight", bodyZones: ["belly", "legs"], desiredBodyShape: "toned" }
  });
  current = await saveStep(created.sessionId, "body", {
    expectedVersion: current.version,
    answers: { age: 32, heightCm: 168, currentWeightKg: 74, targetWeightKg: 65, healthDataConsent: true }
  });
  current = await saveStep(created.sessionId, "activity", {
    expectedVersion: current.version,
    answers: { activityLevel: "moderate", exerciseFrequency: "3_4_week", typicalDay: "active_breaks" }
  });
  current = await saveStep(created.sessionId, "habits", {
    expectedVersion: current.version,
    answers: {
      sleepHours: "7_8",
      waterIntake: "medium",
      dietPreference: "traditional",
      physicalLimitations: []
    }
  });

  return { sessionId: created.sessionId, version: current.version };
}

export async function createCompleteSubmittedSession() {
  const draft = await createCompleteDraftSession();
  const submitted = await submitAssessment(draft.sessionId, { expectedVersion: draft.version });
  return { sessionId: draft.sessionId, submitted };
}
