import { Activity, Plus, Rocket, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { Modal } from "../../components/modal";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import { useAuth } from "../auth/use-auth";
import { supabase } from "../../lib/supabase/client";
import type { ProjectPriority } from "../../lib/supabase/database.types";
import { listWorkspaceWorkItems } from "../work-items/work-items.queries";
import { ProjectForm, type ProjectFormValues } from "./project-form";
import { buildMissionStats, calculateProjectHealthSignal } from "./project-health";
import { listRepositoryLinks } from "./project-links.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import {
  createProject,
  listProjects,
  projectHealthTone,
  updateProjectFavorite,
} from "./projects.queries";

function priorityTone(priority: ProjectPriority): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ProjectsPage() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // createProject succeeds with the project even when its repository link fails.
  const [linkError, setLinkError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => listProjects(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const workItemsQuery = useQuery({
    queryKey: ["workspace-work-items", workspaceId],
    queryFn: () => listWorkspaceWorkItems(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const projectIds = (projectsQuery.data ?? []).map((project) => project.id);

  const repositoryLinksQuery = useQuery({
    queryKey: ["project-links", "repository", workspaceId, projectIds],
    queryFn: () => listRepositoryLinks(supabase, { workspaceId, projectIds }),
    enabled: Boolean(workspaceId) && projectIds.length > 0,
  });

  // A links failure must not take the project list down with it.
  const repositoryUrls = repositoryLinksQuery.data ?? new Map<string, string>();

  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      if (!user) {
        throw new Error("Choose a workspace before creating a project.");
      }

      return createProject(supabase, {
        workspaceId,
        userId: user.id,
        name: values.name,
        description: values.description,
        status: values.status,
        priority: values.priority,
        health: values.health,
        repositoryUrl: values.repositoryUrl,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["project-links", "repository", workspaceId] });
      // The project exists either way; only the link write can have failed.
      setLinkError(result.linkError);
      setIsCreateOpen(false);
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: (input: { id: string; isFavorite: boolean }) => {

      return updateProjectFavorite(supabase, {
        id: input.id,
        workspaceId,
        isFavorite: input.isFavorite,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });

  function openCreateModal() {
    createProjectMutation.reset();
    setLinkError(null);
    setIsCreateOpen(true);
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading missions" message="Checking your session before loading project data." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to view and launch missions." />;
  }

  const projects = projectsQuery.data ?? [];
  const workItems = workItemsQuery.data ?? [];
  const dateKey = todayDateKey();

  const healthSignalById = new Map(
    projects.map((project) => {
      const projectWorkItems = workItems.filter((item) => item.project_id === project.id);
      const signal = workItemsQuery.isSuccess
        ? calculateProjectHealthSignal(project, projectWorkItems, dateKey)
        : {
            health: project.health,
            reason: workItemsQuery.isPending ? "Scanning project signals." : "Using saved project health.",
          };

      return [project.id, signal] as const;
    }),
  );

  const missionStats = buildMissionStats(
    projects.map((project) => ({
      status: project.status,
      health: healthSignalById.get(project.id)?.health ?? project.health,
    })),
  );

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mission-label">Mission registry</p>
          <h1 className="mt-2 text-3xl font-black text-white">Projects in orbit.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Track active work, priority, and health in one orbital system.</p>
        </div>
        <button
          className="orbit-button"
          onClick={openCreateModal}
          type="button"
        >
          <Plus size={16} />
          Launch project
        </button>
      </div>

      {!projectsQuery.isPending && !projectsQuery.isError && projects.length > 0 ? (
        <div aria-label="Mission telemetry" className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Rocket, label: "Active projects", value: String(missionStats.active) },
            { icon: ShieldCheck, label: "On track", value: String(missionStats.onTrack) },
            { icon: Activity, label: "Overall health", value: missionStats.overall },
          ].map(({ icon: Icon, label, value }) => (
            <div className="surface-quiet flex items-center gap-3 rounded-xl p-4" key={label}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p aria-label={`${label} count`} className="text-xl font-black text-white">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {linkError ? (
        <p
          className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
          role="alert"
        >
          Project created, but the repository link could not be saved. {linkError}
        </p>
      ) : null}

      {projectsQuery.isPending ? (
        <EmptyState isLoading title="Loading missions" message="Fetching the latest project list." />
      ) : null}

      {projectsQuery.isError ? (
        <EmptyState title="Could not load projects" message={projectsQuery.error.message} />
      ) : null}

      {!projectsQuery.isPending && !projectsQuery.isError && projects.length === 0 ? (
        <EmptyState
          action={
            <button
              className="orbit-button"
              onClick={openCreateModal}
              type="button"
            >
              <Plus size={16} />
              Launch project
            </button>
          }
          title="No missions queued"
          message="Launch your first project to start organizing work."
          illustration="projects"
        />
      ) : null}

      {!projectsQuery.isPending && !projectsQuery.isError && projects.length > 0 ? (
        <div className="grid gap-3">
          {projects.map((project) => {
            const repositoryUrl = repositoryUrls.get(project.id) ?? null;
            const healthSignal = healthSignalById.get(project.id) ?? {
              health: project.health,
              reason: "Using saved project health.",
            };

            return (
              <article
                aria-label={`${project.name} mission`}
                className="mission-registry-row surface-quiet relative grid gap-5 rounded-xl p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                key={project.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      aria-label={`${project.is_favorite ? "Unfavorite" : "Favorite"} ${project.name}`}
                      aria-pressed={project.is_favorite}
                      className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:text-amber-200"
                      disabled={favoriteMutation.isPending}
                      onClick={() => favoriteMutation.mutate({ id: project.id, isFavorite: !project.is_favorite })}
                      type="button"
                    >
                      <Star
                        aria-hidden="true"
                        className={project.is_favorite ? "h-4 w-4 fill-amber-300 text-amber-300" : "h-4 w-4"}
                      />
                    </button>
                    <Link
                      aria-label={`Open ${project.name} mission`}
                      className="text-lg font-semibold text-white after:absolute after:inset-0"
                      to={workspacePath(workspaceId, `/projects/${project.id}`)}
                    >
                      {project.name}
                    </Link>
                    <StatusPill>{formatLabel(project.status)}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{project.description}</p>
                  {repositoryUrl ? (
                    <a
                      className="relative z-10 mt-3 inline-flex text-sm font-medium text-cyan-200"
                      href={repositoryUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {repositoryUrl}
                    </a>
                  ) : null}
                </div>
                <div className="relative z-10 grid min-w-[17rem] grid-cols-2 gap-4 border-l border-white/[0.08] pl-6">
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Priority</p>
                    <div className="mt-2">
                      <StatusPill tone={priorityTone(project.priority)}>{project.priority}</StatusPill>
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Health</p>
                    <div className="mt-2">
                      <StatusPill tone={projectHealthTone(healthSignal.health)}>
                        {formatLabel(healthSignal.health)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 max-w-[13rem] text-xs leading-5 text-slate-400">{healthSignal.reason}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {isCreateOpen ? (
        <Modal title="Launch project" onClose={() => setIsCreateOpen(false)}>
          <ProjectForm
            isSubmitting={createProjectMutation.isPending}
            onSubmit={(values) => createProjectMutation.mutate(values)}
          />
          {createProjectMutation.isError ? (
            <p className="mt-3 text-sm text-violet-100">{createProjectMutation.error.message}</p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}
