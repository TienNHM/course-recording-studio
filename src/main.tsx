import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFonts } from "./theme/fonts";
import { PreferencesProvider } from "./theme/PreferencesProvider";

installFonts();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
