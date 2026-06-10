import { Prisma, QuizSessionStatus } from "@prisma/client";
import { AppError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import { buildResultResponse } from "../access/result-access";
import { fromDbSubscriptionStatus, toDbGoalDirection } from "../quiz/mappers";
import { parseSubmitPayload } from "../quiz/schemas";
import { sessionToAssessmentInput } from "../quiz/service";
import { ALGORITHM_VERSION, calculateHealthAssessment } from "./algorithm";

export async function submitAssessment(sessionId: string, payload: unknown) {
  const input = parseSubmitPayload(payload);

  return prisma.$transaction(async (tx) => {
    const session = await tx.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new AppError("NOT_FOUND", { details: ["sessionId"] });
    if (session.version !== input.expectedVersion) {
      throw new AppError("VERSION_CONFLICT", {
        details: { currentVersion: session.version, expectedVersion: input.expectedVersion }
      });
    }

    const assessmentInput = sessionToAssessmentInput(session);
    const existing = await tx.assessmentResult.findUnique({
      where: {
        sessionId_sourceSessionVersion: {
          sessionId,
          sourceSessionVersion: session.version
        }
      }
    });

    if (existing) {
      await tx.quizSession.update({
        where: { id: sessionId },
        data: { status: QuizSessionStatus.COMPLETED, completedAt: session.completedAt ?? new Date() }
      });
      return {
        sessionId,
        status: "completed" as const,
        resultId: existing.id,
        algorithmVersion: existing.algorithmVersion,
        version: session.version,
        next: `/result?sessionId=${sessionId}`
      };
    }

    const result = calculateHealthAssessment(assessmentInput);
    await tx.assessmentResult.updateMany({
      where: { sessionId, status: "CURRENT" },
      data: { status: "STALE", invalidatedAt: new Date() }
    });
    const created = await tx.assessmentResult.create({
      data: {
        sessionId,
        sourceSessionVersion: session.version,
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

    await tx.quizSession.update({
      where: { id: sessionId },
      data: { status: QuizSessionStatus.COMPLETED, completedAt: new Date() }
    });

    return {
      sessionId,
      status: "completed" as const,
      resultId: created.id,
      algorithmVersion: created.algorithmVersion,
      version: session.version,
      next: `/result?sessionId=${sessionId}`
    };
  });
}

export async function getResultForSession(sessionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      subscription: true,
      results: {
        where: { status: "CURRENT" },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });
  if (!session) throw new AppError("NOT_FOUND", { details: ["sessionId"] });
  const result = session.results[0];
  if (!result) throw new AppError("RESULT_NOT_READY", { details: ["result"] });

  const now = new Date();
  const active =
    session.subscription?.status === "ACTIVE" &&
    (!session.subscription.activeUntil || session.subscription.activeUntil > now);
  const subscriptionStatus = active ? "active" : fromDbSubscriptionStatus(session.subscription?.status);
  return buildResultResponse(
    {
      ...result,
      goalDirection: result.goalDirection.toLowerCase()
    },
    subscriptionStatus
  );
}
