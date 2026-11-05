import { bump, flushSync, markDirty } from "./store";

/**
 * Local-storage replacement for next/cache's revalidatePath: saves the
 * database and makes every mounted page reload its data.
 */
export function revalidatePath(..._args: unknown[]) {
  void _args;
  markDirty();
  flushSync(); // persist immediately so a reload right after an action keeps it
  bump();
}
