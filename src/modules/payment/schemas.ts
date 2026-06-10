import { z } from "zod";
import { AppError } from "../../shared/errors";
import { assertNoDangerousKeys } from "../../shared/json";

export const payRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    idempotencyKey: z.string().trim().min(8).max(120),
    status: z.enum(["succeeded", "failed"]).default("succeeded")
  })
  .strict();

export function parsePayPayload(payload: unknown) {
  try {
    assertNoDangerousKeys(payload);
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", {
      details: [error instanceof Error ? error.message : "dangerous key"]
    });
  }
  return payRequestSchema.parse(payload);
}

