import { useState, useSyncExternalStore } from "react";

// Player position (ms on the rendered video) shared with the timeline and the
// transcript without re-rendering the whole Review page on every frame.
export type PlayheadStore = {
  get: () => number;
  set: (ms: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createPlayheadStore = (): PlayheadStore => {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (ms) => {
      if (ms !== value) {
        value = ms;
        listeners.forEach((l) => l());
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const usePlayheadStore = () => useState(createPlayheadStore)[0];

export const usePlayerMs = (store: PlayheadStore) =>
  useSyncExternalStore(store.subscribe, store.get, store.get);
