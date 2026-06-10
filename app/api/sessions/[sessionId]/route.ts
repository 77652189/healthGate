import { restoreSession } from "../../../../src/modules/quiz/service";
import { handleRouteError, jsonResponse } from "../../../../src/shared/http";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const result = await restoreSession(sessionId);
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

