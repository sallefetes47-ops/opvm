﻿import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <div dir="rtl" lang="ar">
        <App />
    </div>
);
