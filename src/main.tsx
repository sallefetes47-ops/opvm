import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <div dir="rtl" lang="ar">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </div>
);
