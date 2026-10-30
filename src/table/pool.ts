// A fixed-size object pool: nothing is allocated while cues play, so there are no GC spikes.
export class Pool<T> {
  private free: T[] = [];
  private used = new Set<T>();
  readonly capacity: number;

  constructor(capacity: number, make: (index: number) => T, private readonly reset?: (item: T) => void) {
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) this.free.push(make(i));
  }

  /** Takes an item, or null when the pool is exhausted (callers skip the effect rather than allocate). */
  acquire(): T | null {
    const item = this.free.pop();
    if (item === undefined) return null;
    this.used.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.used.delete(item)) return;
    this.reset?.(item);
    this.free.push(item);
  }

  releaseAll(): void { for (const item of [...this.used]) this.release(item); }
  get inUse(): number { return this.used.size; }
  get available(): number { return this.free.length; }
}
