type InitSqlJs = (moduleConfig?: Record<string, unknown>) => Promise<unknown>;

declare global {
  interface Window {
    initSqlJs?: InitSqlJs;
  }
}

let loadScriptPromise: Promise<void> | null = null;

function loadSqlJsScript() {
  if (window.initSqlJs) {
    return Promise.resolve();
  }

  if (loadScriptPromise) {
    return loadScriptPromise;
  }

  loadScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sqljs="runtime"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load sql.js runtime.")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "./node_modules/sql.js/dist/sql-wasm.js";
    script.async = true;
    script.dataset.sqljs = "runtime";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load sql.js runtime.")), {
      once: true
    });
    document.head.appendChild(script);
  });

  return loadScriptPromise;
}

export default async function initSqlJs(moduleConfig?: Record<string, unknown>) {
  await loadSqlJsScript();
  if (!window.initSqlJs) {
    throw new Error("sql.js runtime loaded but initSqlJs was not found on window.");
  }
  return window.initSqlJs(moduleConfig);
}
