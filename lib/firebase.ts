import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCwU3uqQKjnE3o4X_gtS71UjQHvqXUz9Zg",
  authDomain: "reimburseme-2eb3c.firebaseapp.com",
  projectId: "reimburseme-2eb3c",
  storageBucket: "reimburseme-2eb3c.firebasestorage.app",
  messagingSenderId: "531228568328",
  appId: "1:531228568328:web:cd377e46236e725c379abd",
  measurementId: "G-KV8DVZ6S8R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();