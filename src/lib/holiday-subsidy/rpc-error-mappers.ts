/**
 * Map approve_subsidy / approve_user_subsidy trigger errors to actionable HTTP status codes.
 */
export function mapApproveRpcError(message: string): { status: number; error: string } {
	if (message.startsWith("Invalid transition")) {
		return { status: 409, error: message };
	}
	if (message.startsWith("Only JCRC")) {
		return { status: 403, error: message };
	}
	if (message.includes("not found") || message.includes("not accessible")) {
		return { status: 404, error: message };
	}
	if (message.includes("only accepts")) {
		return { status: 400, error: message };
	}
	return { status: 400, error: message };
}
