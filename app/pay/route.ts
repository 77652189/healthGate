import { pay } from "../../src/modules/payment/service";
import { handleRouteError, jsonResponse, readJson } from "../../src/shared/http";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return jsonResponse(await pay(body));
  } catch (error) {
    return handleRouteError(error);
  }
}

