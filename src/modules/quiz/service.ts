import { Prisma, QuizSessionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors";
import { asRecord, asStringArray, hasOwn } from "../../shared/json";
import { prisma } from "../../shared/prisma";
import {
  fromDbActivityLevel,
  fromDbExerciseFrequency,
  fromDbGender,
  fromDbGoalType,
  fromDbSessionStatus,
  fromDbStepKey,
  toDbActivityLevel,
  toDbExerciseFrequency,
  toDbGender,
  toDbGoalType,
  toDbStepKey
} from "./mappers";
import { parseCreateSessionPayload, parseStepPatchPayload } from "./schemas";
import type { ActivityLevel, AssessmentInput, ExerciseFrequency, Gender, GoalType, StepKey } from "./types";

type DbSession = Prisma.QuizSessionGetPayload<Record<string, never>>;

interface SessionSnapshot {
  gender: Gender | null;
  goalType: GoalType | null;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: ActivityLevel | null;
  exerciseFrequency: ExerciseFrequency | null;
  bodyZones: string[];
  physicalLimitations: string[];
  healthDataConsent: boolean;
  extra: Record<string, unknown>;
}

const stepOrder: StepKey[] = ["profile", "goal", "body", "activity", "habits"];

export function getStepOrder() {
  return stepOrder;
}

function toSnapshot(session: DbSession): SessionSnapshot {
  return {
    gender: session.gender ? fromDbGender[session.gender] : null,
    goalType: session.goalType ? fromDbGoalType[session.goalType] : null,
    age: session.age,
    heightCm: session.heightCm,
    currentWeightKg: session.currentWeightKg,
    targetWeightKg: session.targetWeightKg,
    activityLevel: session.activityLevel ? fromDbActivityLevel[session.activityLevel] : null,
    exerciseFrequency: session.exerciseFrequency ? fromDbExerciseFrequency[session.exerciseFrequency] : null,
    bodyZones: asStringArray(session.bodyZones),
    physicalLimitations: asStringArray(session.physicalLimitations),
    healthDataConsent: session.healthDataConsent,
    extra: asRecord(session.answersJson)
  };
}

function cloneSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return {
    ...snapshot,
    bodyZones: [...snapshot.bodyZones],
    physicalLimitations: [...snapshot.physicalLimitations],
    extra: { ...snapshot.extra }
  };
}

function isStepComplete(snapshot: SessionSnapshot, stepKey: StepKey) {
  if (stepKey === "profile") {
    return Boolean(snapshot.gender && snapshot.extra.ageRange && snapshot.extra.currentBodyShape);
  }
  if (stepKey === "goal") {
    return Boolean(snapshot.goalType && snapshot.bodyZones.length > 0 && snapshot.extra.desiredBodyShape);
  }
  if (stepKey === "body") {
    return Boolean(
      snapshot.age &&
        snapshot.heightCm &&
        snapshot.currentWeightKg &&
        snapshot.targetWeightKg &&
        snapshot.healthDataConsent
    );
  }
  if (stepKey === "activity") {
    return Boolean(snapshot.activityLevel && snapshot.exerciseFrequency && snapshot.extra.typicalDay);
  }
  return Boolean(
    snapshot.extra.sleepHours &&
      snapshot.extra.waterIntake &&
      snapshot.extra.dietPreference &&
      snapshot.extra.physicalLimitationsAnswered
  );
}

export function calculateCompletedSteps(snapshot: SessionSnapshot) {
  return stepOrder.filter((stepKey) => isStepComplete(snapshot, stepKey));
}

function calculateCurrentStep(snapshot: SessionSnapshot): StepKey {
  return stepOrder.find((stepKey) => !isStepComplete(snapshot, stepKey)) ?? "habits";
}

function mergeStepAnswers(snapshot: SessionSnapshot, stepKey: StepKey, answers: Record<string, unknown>) {
  const merged = cloneSnapshot(snapshot);

  if (stepKey === "profile") {
    if (hasOwn(answers, "gender")) merged.gender = answers.gender as Gender;
    if (hasOwn(answers, "ageRange")) merged.extra.ageRange = answers.ageRange;
    if (hasOwn(answers, "currentBodyShape")) merged.extra.currentBodyShape = answers.currentBodyShape;
  }

  if (stepKey === "goal") {
    if (hasOwn(answers, "goalType")) merged.goalType = answers.goalType as GoalType;
    if (hasOwn(answers, "bodyZones")) merged.bodyZones = answers.bodyZones as string[];
    if (hasOwn(answers, "desiredBodyShape")) merged.extra.desiredBodyShape = answers.desiredBodyShape;
  }

  if (stepKey === "body") {
    if (hasOwn(answers, "age")) merged.age = answers.age as number;
    if (hasOwn(answers, "heightCm")) merged.heightCm = answers.heightCm as number;
    if (hasOwn(answers, "currentWeightKg")) merged.currentWeightKg = answers.currentWeightKg as number;
    if (hasOwn(answers, "targetWeightKg")) merged.targetWeightKg = answers.targetWeightKg as number;
    if (hasOwn(answers, "healthDataConsent")) merged.healthDataConsent = true;
  }

  if (stepKey === "activity") {
    if (hasOwn(answers, "activityLevel")) merged.activityLevel = answers.activityLevel as ActivityLevel;
    if (hasOwn(answers, "exerciseFrequency")) {
      merged.exerciseFrequency = answers.exerciseFrequency as ExerciseFrequency;
    }
    if (hasOwn(answers, "typicalDay")) merged.extra.typicalDay = answers.typicalDay;
  }

  if (stepKey === "habits") {
    if (hasOwn(answers, "sleepHours")) merged.extra.sleepHours = answers.sleepHours;
    if (hasOwn(answers, "waterIntake")) merged.extra.waterIntake = answers.waterIntake;
    if (hasOwn(answers, "dietPreference")) merged.extra.dietPreference = answers.dietPreference;
    if (hasOwn(answers, "physicalLimitations")) {
      merged.physicalLimitations = answers.physicalLimitations as string[];
      merged.extra.physicalLimitationsAnswered = true;
    }
  }

  return merged;
}

function arraysEqual(left: string[], right: string[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function coreChanged(before: SessionSnapshot, after: SessionSnapshot) {
  return (
    before.gender !== after.gender ||
    before.goalType !== after.goalType ||
    before.age !== after.age ||
    before.heightCm !== after.heightCm ||
    before.currentWeightKg !== after.currentWeightKg ||
    before.targetWeightKg !== after.targetWeightKg ||
    before.activityLevel !== after.activityLevel ||
    before.exerciseFrequency !== after.exerciseFrequency ||
    before.healthDataConsent !== after.healthDataConsent ||
    !arraysEqual(before.bodyZones, after.bodyZones)
  );
}

function buildSessionUpdateData(snapshot: SessionSnapshot, current: DbSession, now: Date) {
  const completedSteps = calculateCompletedSteps(snapshot);
  const currentStep = calculateCurrentStep(snapshot);

  return {
    gender: snapshot.gender ? toDbGender[snapshot.gender] : null,
    goalType: snapshot.goalType ? toDbGoalType[snapshot.goalType] : null,
    age: snapshot.age,
    heightCm: snapshot.heightCm,
    currentWeightKg: snapshot.currentWeightKg,
    targetWeightKg: snapshot.targetWeightKg,
    activityLevel: snapshot.activityLevel ? toDbActivityLevel[snapshot.activityLevel] : null,
    exerciseFrequency: snapshot.exerciseFrequency ? toDbExerciseFrequency[snapshot.exerciseFrequency] : null,
    bodyZones: snapshot.bodyZones as Prisma.InputJsonValue,
    physicalLimitations: snapshot.physicalLimitations as Prisma.InputJsonValue,
    healthDataConsent: snapshot.healthDataConsent,
    healthDataConsentAt: snapshot.healthDataConsent ? (current.healthDataConsentAt ?? now) : null,
    answersJson: snapshot.extra as Prisma.InputJsonValue,
    completedSteps: completedSteps as Prisma.InputJsonValue,
    currentStep: toDbStepKey[currentStep]
  };
}

function buildProgressResponse(session: DbSession) {
  const snapshot = toSnapshot(session);
  return {
    sessionId: session.id,
    version: session.version,
    currentStep: fromDbStepKey[session.currentStep],
    completedSteps: calculateCompletedSteps(snapshot),
    status: fromDbSessionStatus[session.status]
  };
}

export function buildRestoreResponse(session: DbSession) {
  const snapshot = toSnapshot(session);
  return {
    session: {
      id: session.id,
      status: fromDbSessionStatus[session.status],
      version: session.version,
      currentStep: fromDbStepKey[session.currentStep],
      completedSteps: calculateCompletedSteps(snapshot),
      answers: {
        required: {
          gender: snapshot.gender,
          goalType: snapshot.goalType,
          bodyZones: snapshot.bodyZones,
          age: snapshot.age,
          heightCm: snapshot.heightCm,
          currentWeightKg: snapshot.currentWeightKg,
          targetWeightKg: snapshot.targetWeightKg,
          activityLevel: snapshot.activityLevel,
          exerciseFrequency: snapshot.exerciseFrequency,
          healthDataConsent: snapshot.healthDataConsent
        },
        extra: {
          ...snapshot.extra,
          physicalLimitations: snapshot.physicalLimitations
        }
      }
    }
  };
}

export async function createOrResumeSession(payload: unknown, cookieSessionId?: string) {
  const input = parseCreateSessionPayload(payload);

  if (input.resumeExisting && cookieSessionId) {
    const existing = await prisma.quizSession.findUnique({ where: { id: cookieSessionId } });
    if (existing) return buildProgressResponse(existing);
  }

  const user = await prisma.user.create({
    data: { anonymousKey: `anon_${randomUUID()}` }
  });
  const session = await prisma.quizSession.create({
    data: {
      userId: user.id,
      flowTopic: input.flowTopic
    }
  });
  return buildProgressResponse(session);
}

export async function restoreSession(sessionId: string) {
  const session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError("NOT_FOUND", { details: ["sessionId"] });
  return buildRestoreResponse(session);
}

export async function saveStep(sessionId: string, stepKey: StepKey, payload: unknown) {
  const input = parseStepPatchPayload(stepKey, payload);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.quizSession.findUnique({ where: { id: sessionId } });
    if (!current) throw new AppError("NOT_FOUND", { details: ["sessionId"] });
    if (current.version !== input.expectedVersion) {
      throw new AppError("VERSION_CONFLICT", {
        details: { currentVersion: current.version, expectedVersion: input.expectedVersion }
      });
    }

    const before = toSnapshot(current);
    const after = mergeStepAnswers(before, stepKey, input.answers as Record<string, unknown>);
    const shouldInvalidate = current.status === QuizSessionStatus.COMPLETED && coreChanged(before, after);
    const updateData = buildSessionUpdateData(after, current, now);
    const nextVersion = current.version + 1;

    const updated = await tx.quizSession.updateMany({
      where: { id: sessionId, version: input.expectedVersion },
      data: {
        ...updateData,
        version: nextVersion,
        status: shouldInvalidate ? QuizSessionStatus.DRAFT : current.status,
        completedAt: shouldInvalidate ? null : current.completedAt
      }
    });

    if (updated.count === 0) {
      throw new AppError("VERSION_CONFLICT", {
        details: { currentVersion: current.version + 1, expectedVersion: input.expectedVersion }
      });
    }

    if (shouldInvalidate) {
      await tx.assessmentResult.updateMany({
        where: { sessionId, status: "CURRENT" },
        data: { status: "STALE", invalidatedAt: now }
      });
    }

    await tx.stepEvent.create({
      data: {
        sessionId,
        stepKey: toDbStepKey[stepKey],
        versionBefore: current.version,
        versionAfter: nextVersion,
        payload: input.answers as Prisma.InputJsonValue
      }
    });

    const next = await tx.quizSession.findUniqueOrThrow({ where: { id: sessionId } });
    return {
      ...buildProgressResponse(next),
      saved: { stepKey }
    };
  });
}

export function sessionToAssessmentInput(session: DbSession): AssessmentInput {
  const snapshot = toSnapshot(session);
  const completedSteps = calculateCompletedSteps(snapshot);
  const missing = stepOrder.filter((stepKey) => !completedSteps.includes(stepKey));
  if (missing.length > 0) {
    throw new AppError("INCOMPLETE_SESSION", { details: missing });
  }

  if (
    !snapshot.gender ||
    !snapshot.goalType ||
    !snapshot.age ||
    !snapshot.heightCm ||
    !snapshot.currentWeightKg ||
    !snapshot.targetWeightKg ||
    !snapshot.activityLevel ||
    !snapshot.exerciseFrequency ||
    !snapshot.healthDataConsent
  ) {
    throw new AppError("INCOMPLETE_SESSION", { details: ["required"] });
  }

  return {
    gender: snapshot.gender,
    goalType: snapshot.goalType,
    age: snapshot.age,
    heightCm: snapshot.heightCm,
    currentWeightKg: snapshot.currentWeightKg,
    targetWeightKg: snapshot.targetWeightKg,
    activityLevel: snapshot.activityLevel,
    exerciseFrequency: snapshot.exerciseFrequency,
    healthDataConsent: true
  };
}

