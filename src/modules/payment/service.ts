import { PaymentEventStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AppError } from "../../shared/errors";
import { prisma } from "../../shared/prisma";
import { fromDbSubscriptionStatus, fromPaymentEventStatus, toPaymentEventStatus } from "../quiz/mappers";
import { parsePayPayload } from "./schemas";

const PROVIDER = "mock";

export async function pay(payload: unknown) {
  const input = parsePayPayload(payload);

  return prisma.$transaction(async (tx) => {
    const session = await tx.quizSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new AppError("NOT_FOUND", { details: ["sessionId"] });

    const existing = await tx.paymentEvent.findUnique({
      where: { provider_idempotencyKey: { provider: PROVIDER, idempotencyKey: input.idempotencyKey } }
    });
    const requestedStatus = toPaymentEventStatus[input.status];

    if (existing) {
      if (existing.sessionId !== input.sessionId || existing.status !== requestedStatus) {
        throw new AppError("IDEMPOTENCY_CONFLICT", {
          details: { idempotencyKey: input.idempotencyKey }
        });
      }
      const subscription = await tx.subscription.findUnique({ where: { sessionId: input.sessionId } });
      return {
        paymentEventId: existing.id,
        status: fromPaymentEventStatus[existing.status],
        subscriptionStatus: fromDbSubscriptionStatus(subscription?.status)
      };
    }

    try {
      const event = await tx.paymentEvent.create({
        data: {
          sessionId: input.sessionId,
          provider: PROVIDER,
          idempotencyKey: input.idempotencyKey,
          status: requestedStatus,
          payload: input
        }
      });

      let subscriptionStatus = "none";
      if (requestedStatus === PaymentEventStatus.SUCCEEDED) {
        const subscription = await tx.subscription.upsert({
          where: { sessionId: input.sessionId },
          update: {
            status: SubscriptionStatus.ACTIVE,
            activeFrom: new Date(),
            activeUntil: null
          },
          create: {
            sessionId: input.sessionId,
            status: SubscriptionStatus.ACTIVE,
            activeFrom: new Date()
          }
        });
        subscriptionStatus = fromDbSubscriptionStatus(subscription.status);
      }

      return {
        paymentEventId: event.id,
        status: fromPaymentEventStatus[event.status],
        subscriptionStatus
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("IDEMPOTENCY_CONFLICT", {
          details: { idempotencyKey: input.idempotencyKey }
        });
      }
      throw error;
    }
  });
}

