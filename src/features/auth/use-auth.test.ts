import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "./use-auth";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}));

type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void;
type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

const getSessionMock = vi.mocked(supabase.auth.getSession);
const onAuthStateChangeMock = vi.mocked(supabase.auth.onAuthStateChange);

let authCallback: AuthCallback;
let unsubscribe: () => void;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createSession(userId: string): Session {
  return {
    access_token: `${userId}-access-token`,
    refresh_token: `${userId}-refresh-token`,
    expires_in: 3600,
    expires_at: 1_893_456_000,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

beforeEach(() => {
  unsubscribe = () => {};
  getSessionMock.mockReset();
  onAuthStateChangeMock.mockReset();
  onAuthStateChangeMock.mockImplementation((callback) => {
    authCallback = callback;
    return {
      data: {
        subscription: {
          id: "test-subscription",
          callback,
          unsubscribe,
        },
      },
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAuth", () => {
  it("keeps a newer auth event when getSession resolves later", async () => {
    const initialSession = createSession("initial-user");
    const eventSession = createSession("event-user");
    const getSession = createDeferred<GetSessionResult>();
    getSessionMock.mockReturnValue(getSession.promise);

    const { result } = renderHook(() => useAuth());

    act(() => {
      authCallback("SIGNED_IN", eventSession);
    });

    expect(result.current).toEqual({
      isLoading: false,
      session: eventSession,
      user: eventSession.user,
    });

    await act(async () => {
      getSession.resolve({
        data: { session: initialSession },
        error: null,
      });
      await getSession.promise;
    });

    expect(result.current).toEqual({
      isLoading: false,
      session: eventSession,
      user: eventSession.user,
    });
  });

  it("clears loading and keeps null auth state when getSession rejects", async () => {
    getSessionMock.mockRejectedValue(new Error("storage unavailable"));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current).toEqual({
        isLoading: false,
        session: null,
        user: null,
      });
    });
  });
});
