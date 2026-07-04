import { Highlight } from "../api/activity-history";

export class HighlightBuilder {
  #data: Map<string, (() => string) | undefined>;

  constructor() {
    this.#data = new Map();
  }

  addStr(key: string, value: string) {
    this.#data.set(key, () => value);
  }

  addNum(key: string, value: number) {
    this.#data.set(key, () => value.toFixed(2));
  }

  addFlag(key: string) {
    this.#data.set(key, undefined);
  }

  addInt(key: string, value: number) {
    this.#data.set(key, () => `x${value}`);
  }

  build(): Highlight[] {
    const list = [] as Highlight[];
    this.#data.forEach((item, key) => {
      const content = item ? item() : undefined;
      if (!content) {
        // flag
        list.push(key);
      } else {
        list.push([key, content]);
      }
    });
    return list;
  }
}
