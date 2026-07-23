import { toast } from "sonner";

/**
 * Runs a server action with the canonical "toast success / toast error"
 * feedback used across the client UI. Behavior matches the inline
 * try/catch + toast blocks it replaces: on success the success toast fires
 * then `onSuccess` (e.g. closing a dialog); on failure the error toast fires.
 */
export async function runAction(
  fn: () => Promise<unknown>,
  messages: { success: string; error: string },
  onSuccess?: () => void,
) {
  try {
    await fn();
    toast.success(messages.success);
    onSuccess?.();
  } catch {
    toast.error(messages.error);
  }
}
