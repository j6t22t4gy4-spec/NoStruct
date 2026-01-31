
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDXe4Hxv-yg3fz-yDl9SuJF6S6GrqxdAK4",
  authDomain: "nostruct-8dba3.firebaseapp.com",
  projectId: "nostruct-8dba3",
  storageBucket: "nostruct-8dba3.firebasestorage.app",
  messagingSenderId: "338339461486",
  appId: "1:338339461486:web:32989c8160f1b0132ce97f",
  measurementId: "G-WCLJFBD2KW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
