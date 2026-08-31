import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { ProjectHealth, ProjectPriority, ProjectStatus } from "../../lib/supabase/database.types";

const statuses = ["active", "paused", "completed", "archived"] as const;
const priorities = ["low", "medium", "high", "critical"] as const;
const healthValues = ["good", "watch", "at_risk", "blocked"] as const;

export interface ProjectFormValues {
  name: string;
  description: string;
  repositoryUrl: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  health: ProjectHealth;
}

export function ProjectForm({
  isSubmitting = false,
  onSubmit,
}: {
  isSubmitting?: boolean;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [health, setHealth] = useState<ProjectHealth>("good");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) return;

    onSubmit({
      name: trimmedName,
      description: description.trim(),
      repositoryUrl: repositoryUrl.trim(),
      status,
      priority,
      health,
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Name">
        <input
          autoFocus
          className="orbit-input"
          disabled={isSubmitting}
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="orbit-input min-h-20"
          disabled={isSubmitting}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </Field>

      <Field label="Repository URL">
        <input
          className="orbit-input"
          disabled={isSubmitting}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          type="url"
          value={repositoryUrl}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status">
          <select
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            value={status}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setPriority(event.target.value as ProjectPriority)}
            value={priority}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Health">
          <select
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setHealth(event.target.value as ProjectHealth)}
            value={health}
          >
            {healthValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          className="orbit-button"
          disabled={isSubmitting || !name.trim()}
          type="submit"
        >
          {isSubmitting ? "Launching..." : "Launch project"}
        </button>
      </div>
    </form>
  );
}
