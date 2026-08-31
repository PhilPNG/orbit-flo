import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import { useUpdatePassword } from "./use-update-password";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

const updateUserMock = vi.mocked(supabase.auth.updateUser);

describe("useUpdatePassword", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
  });

  it("rejects passwords under eight characters without calling Supabase", async () => {
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit");
    });

    expect(outcome).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Passwords need at least 8 characters.");
  });

  it("writes the password and reports success", async () => {
    updateUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit-secret-1");
    });

    expect(outcome).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith({ password: "orbit-secret-1" });
    expect(result.current.error).toBeNull();
  });

  it("surfaces the Supabase error message", async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    } as never);
    const { result } = renderHook(() => useUpdatePassword());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.updatePassword("orbit-secret-1");
    });

    expect(outcome).toBe(false);
    expect(result.current.error).toBe("Auth session missing!");
  });

  it("reports while the write is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    updateUserMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useUpdatePassword());

    act(() => {
      void result.current.updatePassword("orbit-secret-1");
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(true));

    await act(async () => {
      release({ data: { user: null }, error: null });
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(false));
  });

  it("clears the error on request", async () => {
    const { result } = renderHook(() => useUpdatePassword());

    await act(async () => {
      await result.current.updatePassword("short");
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});
