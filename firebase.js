

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
 apiKey: "AIzaSyBEA0MNBi-h5N-JSjvbwPurORuGMU58I1I",
  authDomain: "sewaconnect-33ba4.firebaseapp.com",
  projectId: "sewaconnect-33ba4",
  storageBucket: "sewaconnect-33ba4.firebasestorage.app",
  messagingSenderId: "593379762727",
  appId: "1:593379762727:web:fe0282d99d840c938fe402",
  measurementId: "G-Y9FFNQS650"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and export db
export const db = getFirestore(app);