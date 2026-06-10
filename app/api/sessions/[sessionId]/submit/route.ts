import { submitAssessment } from "../../../../../src/modules/assessment/service";
import { handleRouteError, jsonResponse, readJson } from "../../../../../src/shared/http";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = await readJson(request);
    const result = await submitAssessment(sessionId, body);
    return jsonResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

