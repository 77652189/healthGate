-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuizSessionStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuizStepKey" AS ENUM ('PROFILE', 'GOAL', 'BODY', 'ACTIVITY', 'HABITS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('LOSE_WEIGHT', 'BUILD_STRENGTH', 'IMPROVE_FLEXIBILITY', 'REDUCE_STRESS', 'IMPROVE_POSTURE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE');

-- CreateEnum
CREATE TYPE "ExerciseFrequency" AS ENUM ('NEVER', 'MONTHLY', 'ONE_TWO_WEEK', 'THREE_FOUR_WEEK', 'DAILY');

-- CreateEnum
CREATE TYPE "AssessmentResultStatus" AS ENUM ('CURRENT', 'STALE');

-- CreateEnum
CREATE TYPE "GoalDirection" AS ENUM ('LOSS', 'MAINTAIN', 'GAIN');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "anonymousKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "flowTopic" TEXT NOT NULL DEFAULT 'healthgate_weight_management_v1',
    "status" "QuizSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentStep" "QuizStepKey" NOT NULL DEFAULT 'PROFILE',
    "completedSteps" JSONB NOT NULL DEFAULT '[]',
    "answersJson" JSONB NOT NULL DEFAULT '{}',
    "gender" "Gender",
    "goalType" "GoalType",
    "age" INTEGER,
    "heightCm" DOUBLE PRECISION,
    "currentWeightKg" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "activityLevel" "ActivityLevel",
    "exerciseFrequency" "ExerciseFrequency",
    "bodyZones" JSONB NOT NULL DEFAULT '[]',
    "physicalLimitations" JSONB NOT NULL DEFAULT '[]',
    "healthDataConsent" BOOLEAN NOT NULL DEFAULT false,
    "healthDataConsentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceSessionVersion" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "status" "AssessmentResultStatus" NOT NULL DEFAULT 'CURRENT',
    "bmi" DOUBLE PRECISION NOT NULL,
    "bmiCategory" TEXT NOT NULL,
    "bmr" DOUBLE PRECISION NOT NULL,
    "tdee" DOUBLE PRECISION NOT NULL,
    "recommendedCalories" INTEGER NOT NULL,
    "goalDirection" "GoalDirection" NOT NULL,
    "weeklyDeltaKg" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "publicSummary" TEXT NOT NULL,
    "publicRecommendations" JSONB NOT NULL,
    "caloriePlan" JSONB NOT NULL,
    "projectionCurve" JSONB NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeFrom" TIMESTAMP(3),
    "activeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "status" "PaymentEventStatus" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepKey" "QuizStepKey" NOT NULL,
    "versionBefore" INTEGER NOT NULL,
    "versionAfter" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_anonymousKey_key" ON "User"("anonymousKey");

-- CreateIndex
CREATE INDEX "QuizSession_userId_idx" ON "QuizSession"("userId");

-- CreateIndex
CREATE INDEX "QuizSession_status_idx" ON "QuizSession"("status");

-- CreateIndex
CREATE INDEX "QuizSession_flowTopic_status_idx" ON "QuizSession"("flowTopic", "status");

-- CreateIndex
CREATE INDEX "AssessmentResult_sessionId_status_idx" ON "AssessmentResult"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_sessionId_sourceSessionVersion_key" ON "AssessmentResult"("sessionId", "sourceSessionVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_sessionId_key" ON "Subscription"("sessionId");

-- CreateIndex
CREATE INDEX "PaymentEvent_sessionId_idx" ON "PaymentEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_idempotencyKey_key" ON "PaymentEvent"("provider", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StepEvent_sessionId_stepKey_idx" ON "StepEvent"("sessionId", "stepKey");

-- CreateIndex
CREATE INDEX "StepEvent_sessionId_createdAt_idx" ON "StepEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepEvent" ADD CONSTRAINT "StepEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

