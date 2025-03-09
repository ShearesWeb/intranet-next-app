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
    .select("points")
    .eq("email", email);

  if (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: "Error fetching user data" },
      { status: 500 }
    );
  }

  let userPoints = 0;

  data.forEach(({ points }) => {
    userPoints += points;
  });
  console.log(userPoints);
  return new Response(JSON.stringify({ userPoints }), {
    headers: { "content-type": "application/json" },
  });
}
