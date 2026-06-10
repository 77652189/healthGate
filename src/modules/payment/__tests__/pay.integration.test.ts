import { expect, it } from "vitest";
import { getResultForSession } from "../../assessment/service";
import { submitAssessment } from "../../assessment/service";
import { containsProtectedField } from "../../access/result-access";
import { pay } from "../service";
import {
  describeIntegration,
  setupIntegrationDb,
  createCompleteSubmittedSession,
  createCompleteDraftSession
} from "../../../test/db";

describeIntegration("payment and result access", () => {
  setupIntegrationDb();

  it("changes the same session from preview to full after /pay", async () => {
    const { sessionId } = await createCompleteSubmittedSession();

    const preview = await getResultForSession(sessionId);
    expect(preview.access).toBe("preview");
    expect(containsProtectedField(preview)).toBe(false);

    const payment = await pay({ sessionId, idempotencyKey: "integration-pay-001", status: "succeeded" });
    expect(payment.subscriptionStatus).toBe("active");

    const full = await getResultForSession(sessionId);
    expect(full.access).toBe("full");
    expect(containsProtectedField(full)).toBe(true);
  });

  it("keeps failed payments from activating access and supports idempotent replay", async () => {
    const { sessionId } = await createCompleteSubmittedSession();

    const failed = await pay({ sessionId, idempotencyKey: "integration-pay-failed", status: "failed" });
    const replay = await pay({ sessionId, idempotencyKey: "integration-pay-failed", status: "failed" });

    expect(failed.paymentEventId).toBe(replay.paymentEventId);
    expect(failed.subscriptionStatus).toBe("none");
    expect((await getResultForSession(sessionId)).access).toBe("preview");
  });

  it("rejects idempotency key conflicts", async () => {
    const first = await createCompleteSubmittedSession();
    const second = await createCompleteSubmittedSession();
    await pay({ sessionId: first.sessionId, idempotencyKey: "integration-conflict", status: "succeeded" });

    await expect(
      pay({ sessionId: second.sessionId, idempotencyKey: "integration-conflict", status: "succeeded" })
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("allows paying before submit and returns full after submit", async () => {
    const { sessionId, version } = await createCompleteDraftSession();
    await pay({ sessionId, idempotencyKey: "integration-before-submit", status: "succeeded" });
    await expect(getResultForSession(sessionId)).rejects.toMatchObject({ code: "RESULT_NOT_READY" });
    await submitAssessment(sessionId, { expectedVersion: version });
    expect((await getResultForSession(sessionId)).access).toBe("full");
  });
});
