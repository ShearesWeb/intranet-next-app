'use server'

import { createClient } from "@/utils/supabase/server"


export async function getUserInfo() {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()

}