import { createOrResumeSession } from "../../../src/modules/quiz/service";
import { handleRouteError, jsonResponse, readJson } from "../../../src/shared/http";

const sessionCookie = "hg_session_id";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const cookieSessionId = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`))
      ?.split("=")[1];
    const result = await createOrResumeSession(body, cookieSessionId);
    const response = jsonResponse(result, 201);
    response.cookies.set(sessionCookie, result.sessionId, {
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

