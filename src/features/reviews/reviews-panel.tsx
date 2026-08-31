import { Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "../../components/empty-state";
import { Modal } from "../../components/modal";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import { orbitAssets } from "../../lib/orbit-assets";
import { supabase } from "../../lib/supabase/client";
import type { ProjectHealth } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { ReviewForm, type ReviewFormValues } from "./review-form";
import { createWeeklyReview, listWeeklyReviews, reviewHealthLabel, weeklyReviewKeys } from "./reviews.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";

function healthTone(health: ProjectHealth): StatusTone {
  if (health === "good") return "good";
  if (health === "watch") return "warning";
  return "danger";
}

export function ReviewsPanel({ projectId }: { projectId?: string }) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const reviewsQueryKey =
    projectId
      ? weeklyReviewKeys.project(workspaceId, projectId)
      : weeklyReviewKeys.workspace(workspaceId);

  const reviewsQuery = useQuery({
    queryKey: reviewsQueryKey,
    queryFn: () => listWeeklyReviews(supabase, workspaceId, projectId),
    enabled: Boolean(user),
  });

  const createReviewMutation = useMutation({
    mutationFn: (values: ReviewFormValues) => {
      if (!user) {
        throw new Error("Choose a workspace before creating reviews.");
      }

      return createWeeklyReview(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        weekStart: values.weekStart,
        wins: values.wins,
        blockers: values.blockers,
        nextFocus: values.nextFocus,
        health: values.health,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: weeklyReviewKeys.workspace(workspaceId) });
      setIsCreateOpen(false);
    },
  });

  function openCreateModal() {
    createReviewMutation.reset();
    setIsCreateOpen(true);
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading reviews" message="Checking your session before loading reviews." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to log mission reviews." />;
  }

  const reviews = reviewsQuery.data ?? [];

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg border border-cyan-300/15 bg-cyan-300/10">
            <img
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded-sm object-contain drop-shadow-[0_0_14px_rgba(34,211,238,0.24)]"
              src={orbitAssets.icons.reviews}
            />
          </div>
          <p className="mission-label">Mission review</p>
          <h1 className="mt-2 text-3xl font-black text-white">Weekly orbit check.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Log wins, blockers, next focus, and health by week.</p>
        </div>
        <button
          className="orbit-button"
          onClick={openCreateModal}
          type="button"
        >
          <Plus size={16} />
          Log review
        </button>
      </div>

      {reviewsQuery.isPending ? <EmptyState isLoading title="Loading reviews" message="Fetching recent reviews." /> : null}

      {reviewsQuery.isError ? (
        <EmptyState title="Could not load reviews" message={reviewsQuery.error.message} />
      ) : null}

      {!reviewsQuery.isPending && !reviewsQuery.isError && reviews.length === 0 ? (
        <EmptyState
          action={
            <button
              className="orbit-button"
              onClick={openCreateModal}
              type="button"
            >
              <Plus size={16} />
              Log review
            </button>
          }
          title="No orbit checks yet"
          message="Create a weekly review to capture the latest project state."
        />
      ) : null}

      {!reviewsQuery.isPending && !reviewsQuery.isError && reviews.length > 0 ? (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li className="orbit-panel rounded-lg p-4" key={review.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Week of {new Date(`${review.week_start}T00:00:00`).toLocaleDateString()}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Updated {new Date(review.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {review.health ? (
                  <StatusPill tone={healthTone(review.health)}>{reviewHealthLabel(review.health)}</StatusPill>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Wins</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{review.wins || "None logged."}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Blockers</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                    {review.blockers || "None logged."}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">Next focus</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                    {review.next_focus || "None logged."}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isCreateOpen ? (
        <Modal title="Log weekly review" onClose={() => setIsCreateOpen(false)}>
          <ReviewForm
            isSubmitting={createReviewMutation.isPending}
            onSubmit={(values) => createReviewMutation.mutate(values)}
          />
          {createReviewMutation.isError ? (
            <p className="mt-3 text-sm text-violet-100">{createReviewMutation.error.message}</p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}
