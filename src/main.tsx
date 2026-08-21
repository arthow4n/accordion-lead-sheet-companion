import React from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App.tsx";
import "./index.css";

// Check for Service Worker updates when returning to the app
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update();
      });
    }
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element with id 'root'");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
