import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { parse, Options } from "csv-parse";
// supabase client set up for script => note we use Service Role Key because Supabase does not set up user ID in script env
const supabaseUrl = "https://mwkracypvfhvwpzkivco.supabase.co";
const supabaseKey = ""
export const supabase = createClient(supabaseUrl, supabaseKey);

type ValidationResult = {
  validRows: Array<User>;
  invalidRows: Array<{ name: string; errors: string[] }>;
};

// 
interface User {
  name: string;
  email: string;
  room: string;
  is_admin: boolean;
}

export async function readCSVFile(
  filePath: string,
  parserOptions: Options
): Promise<Array<User>> {
  const entries: Array<User> = [];

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      // NOTE: SET COLUMNS TO TRUE IF THE CSV COMES WITH A HEADER
      .pipe(parse({ ...parserOptions, columns: false }))
      .on("data", (row) => {
        entries.push(row);
      })
      .on("error", console.log)
      .on("end", () => resolve(entries));
  });
}

async function validateUserOnboardingData(
  filePath: string
): Promise<ValidationResult> {
  const validRows: User[] = [];
  const invalidRows: { name: string; errors: string[] }[] = [];

  const entries = await readCSVFile(filePath, {
    columns: ["name", "email", "room", "is_admin"],
  });
  console.log(entries);
  return { validRows, invalidRows };
}

(async () => {
  const result = await validateUserOnboardingData(const VALID_EMAIL_REGEX = /^[a-z0-9](\.?[a-z0-9]){5,}@g(oogle)?mail\.com$/;
// // function validate_email(email: string): boolean {
// //   return VALID_EMAIL_REGEX.test(email);
// // }

    "/Users/hrishikeshsathyian/Documents/GitHub/intranet-next-app/intranet-next-app/scripts/users.csv"
  );
  console.log(result);
})();
