import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDP199eOv-Cf3EWlCdGTKZU0c4tRmCV9UU",
  authDomain: "reimburseme-a78c8.firebaseapp.com",
  projectId: "reimburseme-a78c8",
  storageBucket: "reimburseme-a78c8.firebasestorage.app",
  messagingSenderId: "789764423926",
  appId: "1:789764423926:web:076af2d3dff631ee602cd7",
  measurementId: "G-9V708FBHZS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();