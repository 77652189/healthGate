import { prisma } from "../../../src/shared/prisma";
import { jsonResponse } from "../../../src/shared/http";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonResponse({
      ok: true,
      service: "healthgate",
      database: "ok",
      timestamp: new Date().toISOString()
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        service: "healthgate",
        database: "down",
        timestamp: new Date().toISOString()
      },
      503
    );
  }
}

