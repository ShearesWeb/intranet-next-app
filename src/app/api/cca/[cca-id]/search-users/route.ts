import { apiOk, handleApiError } from "@/lib/api/response";
import { searchUsers } from "@/lib/cca/member-service";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	try {
		const { "cca-id": ccaId } = await params;
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("query");
		const users = await searchUsers(ccaId, query);
		return apiOk(users);
	} catch (e) {
		return handleApiError(e);
	}
}
