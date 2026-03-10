/* global document */

let toastEl: HTMLElement | null = null;
let hideTimer: number | null = null;

function getOrCreateToast(): HTMLElement {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.appendChild(toastEl);
  }
  return toastEl;
}

export function showToast(message: string, onClick?: () => void, durationMs = 4000) {
  const el = getOrCreateToast();

  // Clear previous timer / listeners by replacing the node clone trick
  const fresh = el.cloneNode(false) as HTMLElement;
  el.replaceWith(fresh);
  toastEl = fresh;

  fresh.textContent = message;
  fresh.classList.toggle("toast--clickable", !!onClick);

  if (onClick) {
    fresh.addEventListener("click", () => {
      fresh.classList.remove("toast--visible");
      onClick();
    });
  }

  // Trigger transition
  requestAnimationFrame(() => {
    fresh.classList.add("toast--visible");
  });

  if (hideTimer !== null) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    fresh.classList.remove("toast--visible");
    hideTimer = null;
  }, durationMs);
}
