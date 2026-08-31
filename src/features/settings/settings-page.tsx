import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { PageHeader, QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { supabase } from "../../lib/supabase/client";
import { clearStoredWorkspaceId } from "../../lib/supabase/workspace";
import { useAuth } from "../auth/use-auth";
import { useUpdatePassword } from "../auth/use-update-password";
import { InvitationsPanel } from "../invitations/invitations-panel";
import { DangerZonePanel } from "../members/danger-zone-panel";
import { MembersPanel } from "../members/members-panel";
import { MemberAvatar } from "../profiles/member-avatar";
import { getProfile, updateDisplayName } from "../profiles/profiles.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { listWorkspaces, renameWorkspace, workspacesQueryKey } from "../workspaces/workspaces.queries";
import {
  loadDailyHomeLayout,
  saveDailyHomeLayout,
  type DailyHomeLayout,
} from "../daily/daily-home-layout";

const dailyLayoutOptions: Array<{
  key: keyof DailyHomeLayout;
  label: string;
  description: string;
}> = [
  {
    key: "quickCapture",
    label: "Quick Capture",
    description: "Keep the capture form on your daily home.",
  },
  {
    key: "momentum",
    label: "Mission Momentum",
    description: "Show the compact daily progress ring.",
  },
  {
    key: "suggestions",
    label: "Smart Suggestions",
    description: "Show recommended tasks for today.",
  },
  {
    key: "review",
    label: "Mission Debrief",
    description: "Show the end-of-day review panel.",
  },
];

export function SettingsPage() {
  const { user } = useAuth();
  const [dailyLayout, setDailyLayout] = useState<DailyHomeLayout>(() => loadDailyHomeLayout());
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });
  const currentWorkspace = (workspacesQuery.data ?? []).find(
    (workspace) => workspace.id === workspaceId,
  );

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);

  // Seed once, when the name first arrives. Keying off an empty field instead
  // would refill it the moment the user clears it to type a replacement.
  const hasSeededWorkspaceName = useRef(false);
  useEffect(() => {
    if (currentWorkspace && !hasSeededWorkspaceName.current) {
      hasSeededWorkspaceName.current = true;
      setWorkspaceName(currentWorkspace.name);
    }
  }, [currentWorkspace]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameWorkspace(supabase, { id: workspaceId, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      setWorkspaceMessage("Workspace renamed.");
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(supabase, user?.id ?? ""),
    enabled: Boolean(user?.id),
  });
  const profile = profileQuery.data ?? null;

  const [displayName, setDisplayName] = useState("");
  const [displayNameMessage, setDisplayNameMessage] = useState<string | null>(null);

  const hasSeededDisplayName = useRef(false);
  useEffect(() => {
    if (profile && !hasSeededDisplayName.current) {
      hasSeededDisplayName.current = true;
      setDisplayName(profile.displayName);
    }
  }, [profile]);

  const renameProfileMutation = useMutation({
    mutationFn: (name: string) =>
      updateDisplayName(supabase, { userId: user?.id ?? "", displayName: name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setDisplayNameMessage("Name updated.");
    },
  });

  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const {
    updatePassword,
    isUpdating: isUpdatingPassword,
    error: passwordError,
    clearError: clearPasswordError,
  } = useUpdatePassword();

  async function changePassword() {
    setPasswordMessage(null);
    clearPasswordError();

    if (!(await updatePassword(newPassword))) return;

    setNewPassword("");
    setPasswordMessage("Password updated.");
  }

  function updateDailyLayout(key: keyof DailyHomeLayout, value: boolean) {
    const nextLayout = { ...dailyLayout, [key]: value };
    setDailyLayout(nextLayout);
    saveDailyHomeLayout(nextLayout);
  }

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      clearStoredWorkspaceId();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign out");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <section className="grid gap-5">
      <PageHeader eyebrow="Flight controls" title="Settings">
        Keep the app quiet and tuned to the way you plan.
      </PageHeader>

      <QuietPanel aria-label="Workspace">
        <SectionHeader title="Workspace">Rename the workspace everyone sees.</SectionHeader>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            aria-label="Workspace name"
            className="orbit-input min-w-0 flex-1 sm:max-w-72"
            onChange={(event) => {
              setWorkspaceName(event.target.value);
              setWorkspaceMessage(null);
            }}
            value={workspaceName}
          />
          <button
            className="orbit-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={renameMutation.isPending || !workspaceName.trim()}
            onClick={() => renameMutation.mutate(workspaceName)}
            type="button"
          >
            {renameMutation.isPending ? "Saving..." : "Update name"}
          </button>
        </div>
        {workspaceMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-200">{workspaceMessage}</p>
        ) : null}
        {renameMutation.isError ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {renameMutation.error.message}
          </p>
        ) : null}
      </QuietPanel>

      <QuietPanel className="flex flex-wrap items-center justify-between gap-4" aria-label="Account">
        <div className="flex min-w-0 items-center gap-3">
          {/* Identity is decoration here — a failed profile load leaves the
              email alone rather than breaking the panel. */}
          {profile ? <MemberAvatar displayName={profile.displayName} userId={profile.id} /> : null}
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400">Signed in as</p>
            {profile ? (
              <p className="mt-1 text-sm font-semibold text-white">{profile.displayName}</p>
            ) : null}
            <p className={`text-sm ${profile ? "text-slate-400" : "mt-1 font-semibold text-white"}`}>
              {user?.email}
            </p>
            {errorMessage ? (
              <p className="mt-2 text-sm text-rose-200" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>
        <button
          className="orbit-button-danger-quiet"
          disabled={isSigningOut}
          onClick={signOut}
          type="button"
        >
          <LogOut aria-hidden="true" size={16} />
          Sign out
        </button>
      </QuietPanel>

      <MembersPanel />

      <InvitationsPanel />

      <QuietPanel aria-label="Your name">
        <SectionHeader title="Your name">
          How you appear to everyone else in this workspace.
        </SectionHeader>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            aria-label="Display name"
            className="orbit-input min-w-0 flex-1 sm:max-w-72"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setDisplayNameMessage(null);
            }}
            value={displayName}
          />
          <button
            className="orbit-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={renameProfileMutation.isPending || !displayName.trim()}
            onClick={() => renameProfileMutation.mutate(displayName)}
            type="button"
          >
            {renameProfileMutation.isPending ? "Saving..." : "Update name"}
          </button>
        </div>
        {displayNameMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-200">{displayNameMessage}</p>
        ) : null}
        {renameProfileMutation.isError ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {renameProfileMutation.error.message}
          </p>
        ) : null}
      </QuietPanel>

      <QuietPanel aria-label="Change password">
        <SectionHeader title="Change password">Set a new password for your Orbit Flo account.</SectionHeader>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input
            aria-label="New password"
            autoComplete="new-password"
            className="orbit-input min-w-0 flex-1 sm:max-w-72"
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            type="password"
            value={newPassword}
          />
          <button
            className="orbit-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUpdatingPassword || !newPassword}
            onClick={() => void changePassword()}
            type="button"
          >
            {isUpdatingPassword ? "Updating..." : "Update password"}
          </button>
        </div>
        {passwordMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-200">{passwordMessage}</p>
        ) : null}
        {passwordError ? (
          <p className="mt-3 text-sm text-rose-200" role="alert">
            {passwordError}
          </p>
        ) : null}
      </QuietPanel>

      <QuietPanel>
        <SectionHeader action={<span className="text-xs text-slate-500">Saved automatically</span>} title="Daily home">
          Choose the modules that belong on your daily screen.
        </SectionHeader>
        <div className="mt-5 divide-y divide-white/[0.08]">
          {dailyLayoutOptions.map((option) => (
            <label className="settings-row" key={option.key}>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{option.label}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-400">{option.description}</span>
              </span>
              <input
                aria-label={option.label}
                checked={dailyLayout[option.key]}
                className="orbit-switch"
                onChange={(event) => updateDailyLayout(option.key, event.target.checked)}
                role="switch"
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </QuietPanel>

      <DangerZonePanel />
    </section>
  );
}
