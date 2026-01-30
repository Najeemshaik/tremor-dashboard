export function $(selector: string, root: Document | Element = document): any {
  return root.querySelector(selector);
}

export function $$(selector: string, root: Document | Element = document): any[] {
  return Array.from(root.querySelectorAll(selector));
}
