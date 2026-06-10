import { expect, it } from "vitest";
import { AppError } from "../../../shared/errors";
import { createOrResumeSession, restoreSession, saveStep } from "../service";
import { describeIntegration, setupIntegrationDb } from "../../../test/db";

describeIntegration("quiz persistence", () => {
  setupIntegrationDb();

  it("creates, saves partial steps, supports restore and repeated updates", async () => {
    const created = await createOrResumeSession({ resumeExisting: false, flowTopic: "healthgate_weight_management_v1" });
    expect(created.version).toBe(1);

    let saved = await saveStep(created.sessionId, "goal", {
      expectedVersion: 1,
      answers: { goalType: "lose_weight" }
    });
    expect(saved.version).toBe(2);
    expect(saved.completedSteps).not.toContain("goal");

    saved = await saveStep(created.sessionId, "goal", {
      expectedVersion: 2,
      answers: { bodyZones: ["belly", "legs"], desiredBodyShape: "toned" }
    });
    expect(saved.version).toBe(3);
    expect(saved.completedSteps).toContain("goal");

    saved = await saveStep(created.sessionId, "profile", {
      expectedVersion: 3,
      answers: { gender: "female", ageRange: "30_39", currentBodyShape: "mid_sized" }
    });
    expect(saved.completedSteps).toContain("profile");

    const restored = await restoreSession(created.sessionId);
    const extra = restored.session.answers.extra as Record<string, unknown>;
    expect(restored.session.answers.required.goalType).toBe("lose_weight");
    expect(extra["desiredBodyShape"]).toBe("toned");
  });

  it("uses create-or-resume when a cookie session id is supplied", async () => {
    const created = await createOrResumeSession({ resumeExisting: false });
    const resumed = await createOrResumeSession({ resumeExisting: true }, created.sessionId);
    expect(resumed.sessionId).toBe(created.sessionId);
  });

  it("rejects concurrent updates with stale expectedVersion", async () => {
    const created = await createOrResumeSession({ resumeExisting: false });
    const requests = [
      saveStep(created.sessionId, "profile", {
        expectedVersion: 1,
        answers: { gender: "female" }
      }),
      saveStep(created.sessionId, "profile", {
        expectedVersion: 1,
        answers: { ageRange: "30_39" }
      })
    ];

    const results = await Promise.allSettled(requests);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
    expect((rejected as PromiseRejectedResult).reason.code).toBe("VERSION_CONFLICT");
  });
});
