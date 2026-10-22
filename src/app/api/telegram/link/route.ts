
import { requireAuth } from "@/lib/api/auth";
import { apiOk, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    try {
        const user = await requireAuth();

        return apiOk(
            {
                residentId: user.id,
                message: "Authenticated resident verified.",
            },
            200,
            { "Cache-Control": "no-store, private" },
        );
    } catch (error) {
        return handleApiError(error);
    }
}
