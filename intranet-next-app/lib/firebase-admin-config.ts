import * as admin from "firebase-admin";


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY == undefined ? undefined : process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') , 
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const adminAuth = admin.auth();
export { adminAuth };