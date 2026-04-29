import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'heidless-apps-0',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "suiteutils-db-0");

async function run() {
  const snap = await getDocs(collection(db, "suites"));
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.apps && data.apps.suiteutils) {
      data.apps.suiteutils.environments.production.status = "live";
      await updateDoc(doc(db, "suites", docSnap.id), {
        "apps.suiteutils": data.apps.suiteutils
      });
      console.log("Updated suite: " + docSnap.id);
    }
  }
}
run().catch(console.error);
