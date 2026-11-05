/** Shape returned by every server action used with useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Optional payload, e.g. the code of a created record. */
  data?: Record<string, unknown>;
} | null;

export const initialState: ActionState = null;

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors };
}

export function ok(message?: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data };
}

/** Flattens a zod error into { field: firstMessage }. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
