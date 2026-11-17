import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase.js";

async function testFirestoreConnection() {
  try {
    const docRef = await addDoc(collection(db, "connectionTest"), {
      testMessage: "Firebase is connected via Node.js!",
      timestamp: new Date()
    });
    console.log("Success! Document written with ID: ", docRef.id);
  } catch (error) {
    console.error("Connection failed: ", error);
  }
}

testFirestoreConnection();