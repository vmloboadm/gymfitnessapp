// Navegador mínimo para testar código "use client" no Node:
// window, localStorage (em memória) e navigator.onLine.
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.setItem) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}
if (typeof globalThis.dispatchEvent !== "function") {
  const target = new EventTarget();
  globalThis.dispatchEvent = target.dispatchEvent.bind(target);
  globalThis.addEventListener = target.addEventListener.bind(target);
  globalThis.removeEventListener = target.removeEventListener.bind(target);
}
