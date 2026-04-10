import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA1lkPW5jY1KNwR8BDr3YXgE_3BZIDBAGQ",
  authDomain: "sculptors-ecf98.firebaseapp.com",
  projectId: "sculptors-ecf98",
  storageBucket: "sculptors-ecf98.firebasestorage.app",
  messagingSenderId: "102536701947",
  appId: "1:102536701947:web:65354590eb3cc38d978d5e",
  measurementId: "G-06KZ2M8XKF"
};

export default firebaseConfig;
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);