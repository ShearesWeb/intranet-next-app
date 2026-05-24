import { apiOk, handleApiError } from "@/lib/api/response";
import {
	getMembers,
	addMember,
	removeMember,
	updateMember,
} from "@/lib/cca/member-service";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	try {
		const { "cca-id": ccaId } = await params;
		const result = await getMembers(ccaId);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	try {
		const { "cca-id": ccaId } = await params;
		const body = await req.json();
		const result = await addMember(ccaId, body);
		return apiOk(result);
	} catch (e) {
		return handleApiError(e);
	}
}

export async function DELETE(
	req: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	try {
		const { "cca-id": ccaId } = await params;
		const body = await req.json();
		await removeMember(ccaId, body);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ "cca-id": string }> },
) {
	try {
		const { "cca-id": ccaId } = await params;
		const body = await req.json();
		await updateMember(ccaId, body);
		return apiOk({ success: true });
	} catch (e) {
		return handleApiError(e);
	}
}
