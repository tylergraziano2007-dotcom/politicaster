import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.databaseURL);

let app, auth, db;
if (firebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);
}
export { auth, db };

/** Sign in anonymously (once per browser). Resolves to the user's uid. */
export function ensureSignedIn() {
  if (!firebaseConfigured) return Promise.reject(new Error('Firebase isn’t configured. Add your keys to .env.local (see README).'));
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) { stop(); resolve(user.uid); }
    });
    signInAnonymously(auth).catch((e) => { stop(); reject(e); });
  });
}
