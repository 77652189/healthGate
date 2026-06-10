import { stepKeySchema } from "../../../../../../src/modules/quiz/schemas";
import { saveStep } from "../../../../../../src/modules/quiz/service";
import { handleRouteError, jsonResponse, readJson } from "../../../../../../src/shared/http";

interface RouteContext {
  params: Promise<{ sessionId: string; stepKey: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId, stepKey } = await context.params;
    const parsedStepKey = stepKeySchema.parse(stepKey);
    const body = await readJson(request);
    const result = await saveStep(sessionId, parsedStepKey, body);
    const response = jsonResponse(result);
    response.cookies.set("hg_session_id", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

