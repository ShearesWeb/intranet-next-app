import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export function apiOk<T>(data: T, status = 200, headers?: Record<string, string>) {
	return NextResponse.json({ data, error: null }, { status, headers });
}

export function apiError(message: string, status: number) {
	return NextResponse.json({ data: null, error: message }, { status });
}

export function handleApiError(e: unknown) {
	if (e instanceof ApiError) {
		return apiError(e.message, e.statusCode);
	}
	console.error("Unhandled API error:", e);
	return apiError("Internal server error", 500);
}
