/**
 * Caps concurrent WebGL contexts so Chromium doesn't kill canvases
 * when many animated 3D cards mount at once.
 */

export type ScenePriority = 'card' | 'nav' | 'hero';

type Holder = {
  id: number;
  priority: number;
  revoke: () => void;
};

type Waiter = {
  priority: number;
  cancelled: boolean;
  grant: () => void;
};

const MAX = 16;
let seq = 1;
const held = new Map<number, Holder>();
const queue: Waiter[] = [];

export function priorityValue(p: ScenePriority): number {
  return p === 'hero' ? 3 : p === 'nav' ? 2 : 1;
}

function drain() {
  queue.sort((a, b) => b.priority - a.priority);
  while (queue.length && held.size < MAX) {
    const w = queue.shift()!;
    if (!w.cancelled) w.grant();
  }
}

/**
 * Ask for permission to create a WebGL renderer.
 * - `onGranted()` — create the scene
 * - `onRevoked()` — dispose it (slot taken by higher priority)
 * Returns `dispose()` to call on unmount.
 */
export function holdWebGLSlot(
  priority: ScenePriority,
  handlers: { onGranted: () => void; onRevoked: () => void },
): () => void {
  const p = priorityValue(priority);
  let id: number | null = null;
  let waiter: Waiter | null = null;
  let dead = false;

  const take = () => {
    if (dead || id != null) return;
    id = seq++;
    held.set(id, {
      id,
      priority: p,
      revoke: () => {
        if (id == null) return;
        held.delete(id);
        id = null;
        handlers.onRevoked();
        // Re-queue ourselves as a waiter so we can come back
        if (!dead) enqueue();
        drain();
      },
    });
    handlers.onGranted();
  };

  const enqueue = () => {
    if (dead || waiter) return;
    waiter = {
      priority: p,
      cancelled: false,
      grant: () => {
        waiter = null;
        take();
      },
    };
    queue.push(waiter);
  };

  const tryTake = () => {
    if (held.size < MAX) {
      take();
      return;
    }
    // Steal from a lower-priority holder
    let victim: Holder | null = null;
    for (const h of held.values()) {
      if (h.priority >= p) continue;
      if (!victim || h.priority < victim.priority) victim = h;
    }
    if (victim) {
      victim.revoke();
      take();
      return;
    }
    enqueue();
  };

  tryTake();

  return () => {
    dead = true;
    if (waiter) {
      waiter.cancelled = true;
      const i = queue.indexOf(waiter);
      if (i >= 0) queue.splice(i, 1);
      waiter = null;
    }
    if (id != null) {
      held.delete(id);
      id = null;
      drain();
    }
  };
}
