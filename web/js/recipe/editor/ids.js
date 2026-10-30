// A fresh id for a track, tool, ingredient line or step (a UUID where the browser has one).

export const newId = () => (globalThis.crypto?.randomUUID?.() ?? `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
