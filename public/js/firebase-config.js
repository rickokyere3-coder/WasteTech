// Paste your own Firebase web app settings here.
// Firebase console → ⚙️ Project settings → General → Your apps → (web app) → SDK setup and configuration → Config.
// These values are not secret: they only name your project. Your data is protected by firestore.rules.
export const firebaseConfig = {
  apiKey: "PASTE-YOUR-API-KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// People log in with a username only. Firebase needs an email address, so the app turns
// "kwame_a" into "kwame_a@<USERNAME_DOMAIN>" behind the scenes. No email is ever sent to it.
// Keep this the same forever once people have signed up, or their logins stop working.
export const USERNAME_DOMAIN = "users.wastetech.app";
