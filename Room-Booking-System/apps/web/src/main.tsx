import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReferenceApp as App } from "./reference/ReferenceApp";
import { DemoProvider } from "./app/DemoProvider";
import { AppErrorBoundary } from './components/AppErrorBoundary';
import "./styles.css";
import "./student.css";
import "./server.css";
import "./integrated-ui.css";
import "./reference/reference.css";
import "./reference/desktop.css";
import "./reference/glass.css";
import "./scrollbars.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary><DemoProvider>
      <App />
    </DemoProvider></AppErrorBoundary>
  </StrictMode>,
);
