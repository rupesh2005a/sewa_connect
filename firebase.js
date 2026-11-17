
const firebaseConfig = {
  apiKey: "AIzaSyBEA0MNBi-h5N-JSjvbwPurORuGMU58I1I",
  authDomain: "sewaconnect-33ba4.firebaseapp.com",
  projectId: "sewaconnect-33ba4",
  storageBucket: "sewaconnect-33ba4.firebasestorage.app",
  messagingSenderId: "593379762727",
  appId: "1:593379762727:web:fe0282d99d840c938fe402",
  measurementId: "G-Y9FFNQS650"
};

if (window.firebase) {
  const app = window.firebase.apps.length
    ? window.firebase.app()
    : window.firebase.initializeApp(firebaseConfig);

  window.sevaFirestore = app.firestore();
}