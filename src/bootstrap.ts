import { configureApp, initApp } from "./app.js";
import { createAppDependencies } from "./compositionRoot.js";

document.addEventListener("DOMContentLoaded", async () => {
  const deps = await createAppDependencies();
  configureApp(deps);
  initApp();
});
