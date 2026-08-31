import { useState } from "react";
import { supabase } from "../../lib/supabase/client";

/**
 * Shared by the settings panel and the password reset screen so the length
 * rule and error copy cannot drift apart. Resolves true only when the password
 * was actually written — the caller decides what happens next.
 */
export function useUpdatePassword() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePassword(password: string): Promise<boolean> {
    setError(null);

    if (password.length < 8) {
      setError("Passwords need at least 8 characters.");
      return false;
    }

    setIsUpdating(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the password.");
      return false;
    } finally {
      setIsUpdating(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return { updatePassword, isUpdating, error, clearError };
}
