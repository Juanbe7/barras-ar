import { CHANNELS, type Channel } from "../domain/channel";

export interface ChannelStore {
  /** The channel chosen on this phone; supermarket until the person picks another. */
  current(): Channel;
  /** Remembers the choice and tells the listeners; choosing the current one does nothing. */
  set(channel: Channel): void;
  /** Calls `listener` on every change; returns the function that stops it. */
  subscribe(listener: (channel: Channel) => void): () => void;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "barras-ar:channel";

const isChannel = (value: unknown): value is Channel => CHANNELS.some(({ id }) => id === value);

export function createChannelStore(storage: KeyValueStorage): ChannelStore {
  const listeners = new Set<(channel: Channel) => void>();
  let channel: Channel = "retail";

  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (isChannel(saved)) channel = saved;
  } catch {
    // storage blocked: the choice lasts until the page closes
  }

  return {
    current: () => channel,
    set(next) {
      if (next === channel) return;
      channel = next;
      try {
        storage.setItem(STORAGE_KEY, next);
      } catch {
        // same as above
      }
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
