import { ApiError } from "./errors";

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
	const res = await fetch(url, options);
	const json = await res.json();
	if (!res.ok) {
		throw new ApiError(res.status, json.error || "Request failed");
	}
	return json.data as T;
}
