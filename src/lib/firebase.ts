import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'heidless-apps-0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // SuiteUtils uses its own dedicated database — NOT "(default)"
  const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'suiteutils-db-0';
  db = getFirestore(app, databaseId);
} catch (err) {
  console.error('[Firebase] Initialization failed:', err);
  // Create a minimal fallback so the app doesn't crash
  app = initializeApp(firebaseConfig, 'fallback');
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };
export default app;
