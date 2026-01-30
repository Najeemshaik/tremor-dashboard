import { configureApp, initApp } from "./app.js";
import { createAppDependencies } from "./compositionRoot.js";

document.addEventListener("DOMContentLoaded", () => {
  configureApp(createAppDependencies());
  initApp();
});
