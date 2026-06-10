import { getResultForSession } from "../../../../../src/modules/assessment/service";
import { handleRouteError, jsonResponse } from "../../../../../src/shared/http";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    return jsonResponse(await getResultForSession(sessionId));
  } catch (error) {
    return handleRouteError(error);
  }
}

