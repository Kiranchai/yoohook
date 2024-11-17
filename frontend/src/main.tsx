import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MessagesProvider } from "./providers/MessagesProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <MessagesProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/:webhookId" element={<App />} />
        <Route path="/:webhookId/:messageId" element={<App />} />
        <Route path="*" element={<App />} />
      </Routes>
    </MessagesProvider>
  </BrowserRouter>
);
