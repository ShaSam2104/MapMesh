/**
 * In-memory circular buffer for recent log lines.
 *
 * Used by the dev debug panel and by the "Copy debug info" button in the
 * Export tab so users can paste a useful dump when reporting bugs.
 */

export interface LogEntry {
  /** ISO timestamp. */
  ts: string;
  /** consola level number (0=error, 1=warn, 2=info, 3=debug, 4=trace). */
  level: number;
  /** Level name (`error`, `warn`, `info`, `debug`, `trace`). */
  levelName: string;
  /** Module tag (e.g., `"terrarium"`). */
  tag: string;
  /** Primary message. */
  message: string;
  /** Any extra args passed through the logger. */
  args: unknown[];
}

export class RingBuffer<T> {
  private readonly items: T[] = [];
  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('RingBuffer capacity must be > 0');
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity);
    }
  }

  /** Copy of the contents in insertion order (oldest first). */
  toArray(): T[] {
    return this.items.slice();
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
  }
}

/**
 * The shared 500-entry log buffer used throughout the app.
 */
export const logBuffer = new RingBuffer<LogEntry>(500);
