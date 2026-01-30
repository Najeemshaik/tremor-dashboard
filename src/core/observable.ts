export type Unsubscribe = () => void;

type Listener<T> = (value: T) => void;

export class Observable<T> {
  private value: T;
  private listeners = new Set<Listener<T>>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  get() {
    return this.value;
  }

  set(nextValue: T) {
    this.value = nextValue;
    this.emit();
  }

  update(updater: (current: T) => T) {
    this.value = updater(this.value);
    this.emit();
  }

  subscribe(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.value));
  }
}
