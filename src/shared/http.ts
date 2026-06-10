import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toErrorResponse } from "./errors";

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", { details: ["body"] });
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      },
      { status: 400 }
    );
  }

  const response = toErrorResponse(error);
  return NextResponse.json(response.body, { status: response.status });
}

