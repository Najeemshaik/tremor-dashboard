import { configureApp, initApp } from "./app.js";
import { createAppDependencies } from "./compositionRoot.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const deps = await createAppDependencies();
    configureApp(deps);
    void initApp();
  } catch (error) {
    console.error("App initialization failed.", error);
  }
});
