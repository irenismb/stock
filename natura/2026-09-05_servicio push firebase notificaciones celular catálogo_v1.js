// Servicio web para recibir notificaciones push del catálogo.
// Versión: 1

importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCrC5pmGyX-VaX4f-KI0AU8A6GWP-YDngM",
  authDomain: "mundial-a9de1.firebaseapp.com",
  databaseURL: "https://mundial-a9de1-default-rtdb.firebaseio.com",
  projectId: "mundial-a9de1",
  storageBucket: "mundial-a9de1.firebasestorage.app",
  messagingSenderId: "598028608340",
  appId: "1:598028608340:web:a176c1fbdfcef564419ec1",
  measurementId: "G-YJY5PWKPGJ"
});

firebase.messaging();
