import { createContext, createElement, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

export interface AuthState {
  isLoading: boolean;
  session: Session | null;
  user: User | null;
}

const AuthStateContext = createContext<AuthState | null>(null);

export function AuthStateProvider({
  children,
  value,
}: PropsWithChildren<{ value: AuthState }>) {
  return createElement(AuthStateContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const providedState = useContext(AuthStateContext);
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    session: null,
    user: null,
  });

  useEffect(() => {
    if (providedState) return undefined;

    let isMounted = true;
    let hasAuthEventFired = false;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted || hasAuthEventFired) return;
        if (error) {
          setState({
            isLoading: false,
            session: null,
            user: null,
          });
          return;
        }

        setState({
          isLoading: false,
          session: data.session,
          user: data.session?.user ?? null,
        });
      })
      .catch(() => {
        if (!isMounted || hasAuthEventFired) return;
        setState({
          isLoading: false,
          session: null,
          user: null,
        });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hasAuthEventFired = true;
      setState({
        isLoading: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [providedState]);

  return providedState ?? state;
}
