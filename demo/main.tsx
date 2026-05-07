import { createRoot } from "react-dom/client";
import { DemoApp } from "./demo-app";
import "./demo.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<DemoApp />);
