import "@testing-library/jest-dom/vitest";

class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, value);
  }
}

const localStorage = new MemoryStorage();

Object.defineProperty(window, "localStorage", {
  value: localStorage,
  configurable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorage,
  configurable: true,
});

Object.defineProperty(window, "scrollTo", {
  value: () => {},
  configurable: true,
});
