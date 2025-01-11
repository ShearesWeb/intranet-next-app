import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { parse, Options } from "csv-parse";

// supabase client set up for script => note we use Service Role Key because Supabase does not set up user ID in script env
const supabaseUrl = "https://mwkracypvfhvwpzkivco.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13a3JhY3lwdmZodndwemtpdmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDI4NzQ5MywiZXhwIjoyMDQ1ODYzNDkzfQ.m4mfcGMM2lrnn20jvXFZotr301LZZBAbf4ZVPBMP034";
const supabase = createClient(supabaseUrl, supabaseKey);
const usersTableName = "Users";

// firebase client set up for script
import * as admin from "firebase-admin";
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "intranet-next-app",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC6bydStIrKL0/A\nbUrOUFzdgNsISVSOjICQTxVYgBssPAVfDpVSzZxS4HA/2U1qFhKOb4XQ0yff49sx\n/xU+Zfcbg+sJHMbRBe7QBi/7yqMKCMYC0nY9CiQdVGOfj9z74GsETPYnUTc0pYL/\n1tC+m5pqWBUppYTMyCnN/qjZqam1pASc3RSa4XtzFz5BAkTrKtuNwmBz7wfjpQP4\n0iDVIN+NcVcgvCVgNA7sqE1cQfryNqihh4EnOt5QyH/fA7bL2X++uciJYxTM7bEo\nZeTHxTedkTJ4tJYcwvd/kK7LgP83nQZuAOaHe09ntx52eCoH6bArK76bRgOZtwpV\nRnVvfjM/AgMBAAECggEAAXQHyUwcsf2g/hcAk/1qF1R/hSkEB7huXvq+1ZCg7r0N\nm2E5uME6sQGMlU5CCxUViRazLFWLUgbjhoX1XG8oLxkCb3DkRP8hINu0ocL4UmFq\njksTZ7r5E/O8cxDRu5cuh4RWokxlfA3b8dcpsEBj+XcYl7TM4MczOe/X9ayuCWj9\n36YzeP8nomsjCnMjvOHxYGRXYgrISqj8mTyFMvf2Unc6VyIBRmsKtO7yICBGlOYG\n/qW5BBS/YI5vpEI8MbZjM8tMgZkX/4rMTJiHNns/lb1QsfdYarvFNq35yqlxBbVc\n0Pr7IyHnxI14UccAG6jXkNmbFh2Wds1iyCiVdr7XQQKBgQD/625ebuqSyuEQjdcf\nUMkofiqwOHr8AGa61M+QkZFwfxwqp12vzcGCrqTXdpcSyA7q9UEP1oxwtd6BISiH\ndWTZYQ2vQBm5MuRqCHa3A9yGFd+Dskwm29Xumn6aB17+n80O6SZWy7e9UhfQC/U7\nIULLqdRjMxX4N5bxmUioqc5AVQKBgQC6fiNEmuX76dRflt9P+OUmJn+/XChsz7QP\n5r4MzCRDdYCU9J1Aq8YsCjbnL30qS+0XiURSDsufEET0zPOVl5iO7+QS0ssilcV9\n1e1FK3shSRqzJOJfUky0DUet7pxu+o38W7htK8dFirF7duEOyPe/AQpcHosZyrg3\nLEYBzB7pQwKBgECljTTHmfPI0f+nhN8BPj8/V7M6IT8FLu4lEeW4D+A2C7xumMjv\nFeHYEgXnjBQPe0049N12WfWiy3kdEirdqcMLtDQ/4f+Zbn+mca6biBpK7jJLWNc8\nExd56V8pW4LAhUEt/iRQw7JMSX2hd6ofJctitCb24abZDAUtrmAEvPgdAoGALnLq\nT9UQwRytQ52tQxrn4Aeou721Z9yXqXo8Da3uvkqO2wrN++SMuD1XDV+7mgRNKhaL\nSLDcsGJ5+krtxG18luVS9glAhP2usbfNn/PDeDfgCYx/QWSbLCE+oCiVF+MZ6Cfk\nGHTV7hEsQWcLiQYvBoi4ztbgqGzgUwWY7iur60cCgYBrx/F9VW2CYDtcgxrBnshP\nPgpkbR6ov8htzxuVz+2SSUvgVDgopc28Eydd5vNYPQqFIP9rJ2g3A2zRAZpxG0Z/\n0CrV7VjLdvehkQFw38N2eP/uSjNB1ZXy/hAOItkpt7fcZjhtz2SX2OeEJf2qNIcj\nv25sHGRY40JZTCuF71sUAA==\n-----END PRIVATE KEY-----\n".replace(
          /\\n/g,
          "\n"
        ),
      clientEmail:
        "firebase-adminsdk-mtuwq@intranet-next-app.iam.gserviceaccount.com",
    }),
  });
}
const adminAuth = admin.auth();

type ValidationResult = {
  validRows: Array<User>;
  invalidRows: Array<{ name: string; errors: string[] }>;
};

const VALID_EMAIL_REGEX = /^[a-z0-9](\.?[a-z0-9]){5,}@g(oogle)?mail\.com$/;
function validate_email(email: string): boolean {
  return VALID_EMAIL_REGEX.test(email);
}

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
      // note: setting columns true allows us to return the data as objects, but this also requires us to have a header row !!
      .pipe(parse({ ...parserOptions, columns: true, skip_empty_lines: true }))
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

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    console.log("Entry:", entry);
    const is_email_valid = validate_email(entry.email);
    if (!is_email_valid) {
      invalidRows.push({
        name: entry.name,
        errors: ["Email must be a valid gmail account"],
      });
      continue;
    } else {
      validRows.push(entry);
    }
  }

  return { validRows, invalidRows };
}

(async () => {
  const { validRows, invalidRows } = await validateUserOnboardingData(
    "/Users/hrishikeshsathyian/Documents/GitHub/intranet-next-app/intranet-next-app/scripts/users.csv"
  );
  // add valid users to the database
  validRows.map(async (row) => {
    // handle adding user to supabase
    try {
      await supabase.from(usersTableName).insert({
        name: row.name.toUpperCase(),
        email: row.email,
        room: row.room,
        is_admin: row.is_admin,
      });
      console.log("User added to Supabase Successfully! : ", row.name);
    } catch (error) {
      console.log("Error adding user to Supabase: ", error);
    }
    // handle adding user to firebase
    try {
      await adminAuth.createUser({
        email: row.email,
        displayName: row.name,
      });
      console.log("User added to Firebase Successfully! : ", row.name);
    } catch (error) {
      console.log("Error adding user to Firebase: ", error);
    }
  });

  invalidRows.map((row) => {
    console.log("Invalid Row Error: ", row.errors);
  });
})();
