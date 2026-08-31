/// <reference types="webmcp-types" />
/**
 * Registers Orbit Flo's agent tools with the browser's WebMCP surface.
 *
 * document.modelContext exists only in agent-hosting browsers (Chrome with
 * WebMCP enabled, ChatGPT's in-app browser) - a real Chrome 148 without the
 * flag has no modelContext on any global, verified 2026-08-30. Everywhere
 * else, including every test, this hook does nothing.
 *
 * The feature gate comes FIRST, before anything else is touched: the effect
 * reads the session only after confirming the API exists. That ordering is
 * load-bearing - it means a browser (or test) without WebMCP never pays an
 * auth call for a capability it does not have, and the shell keeps rendering
 * in environments where the auth client is stubbed out.
 *
 * Registration is scoped by an AbortController: unmounting (sign-out tears
 * the shell down) or a workspace switch aborts every registration and, on
 * switch, re-registers against the new workspace. Tools therefore always act
 * on the workspace the user is looking at.
 *
 * The triple-slash reference pulls webmcp-types' global Document augmentation
 * into the program - a types-only devDependency, nothing in the bundle.
 */
import { useEffect } from "react";
import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase/client";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { buildAgentTools } from "./agent-tools";

export function useAgentTools(): void {
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;

    const controller = new AbortController();

    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId || controller.signal.aborted) return;

      for (const tool of buildAgentTools({ client: supabase, queryClient, workspaceId, userId })) {
        void modelContext.registerTool(tool, { signal: controller.signal });
      }
    }).catch(() => {
      // A failed session read means no tools this mount - not a crash. The
      // shell must keep rendering in environments with a stubbed auth client.
    });

    return () => controller.abort();
  }, [workspaceId]);
}
