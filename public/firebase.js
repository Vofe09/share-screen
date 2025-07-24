// Replace with your config
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeoqpWzx9WoU3EvifV7T3Faa3nTYFw_Jw",
  authDomain: "share-screen-91136.firebaseapp.com",
  projectId: "share-screen-91136",
  storageBucket: "share-screen-91136.firebasestorage.app",
  messagingSenderId: "847326052998",
  appId: "1:847326052998:web:d003b856fbc80ecfc98707"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, onValue, set };
