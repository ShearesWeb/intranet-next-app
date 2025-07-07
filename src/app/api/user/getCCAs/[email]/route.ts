import { NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

const USER_CCA_ROLES_TABLE_NAME = "user_cca_roles";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params;
  const { data, error } = await supabase
    .from(USER_CCA_ROLES_TABLE_NAME)
    .select("name, role, points")
    .eq("email", email);

  if (error) {
    console.error("Error fetching user CCA data:", error);
    return NextResponse.json(
      { error: "Error fetching user CCA data" },
      { status: 500 }
    );
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "content-type": "application/json" },
  });
}
