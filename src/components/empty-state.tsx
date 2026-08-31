import { clsx } from "clsx";
import { orbitAssets } from "../lib/orbit-assets";
import { SatelliteLoader, SpaceEmptyIllustration } from "./space-visuals";

type EmptyStateIllustration = "projects" | "notes" | "inbox" | "maps" | "brainstorm" | "today";

const illustrationMap: Record<EmptyStateIllustration, { alt: string; src: string }> = {
  projects: {
    alt: "Empty project constellation",
    src: orbitAssets.illustrations.emptyProjects,
  },
  notes: {
    alt: "Empty notes idea nebula",
    src: orbitAssets.illustrations.emptyNotes,
  },
  inbox: {
    alt: "Quiet orbital signal receiver",
    src: orbitAssets.illustrations.emptyInbox,
  },
  maps: {
    alt: "Open constellation aperture",
    src: orbitAssets.illustrations.emptyMap,
  },
  brainstorm: {
    alt: "Signal nebula waiting for an idea",
    src: orbitAssets.illustrations.emptyBrainstorm,
  },
  today: {
    alt: "Daily orbit waiting for an objective",
    src: orbitAssets.illustrations.emptyToday,
  },
};

type EmptyStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
  illustration?: EmptyStateIllustration;
  isLoading?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  message,
  action,
  illustration,
  isLoading = false,
  className,
}: EmptyStateProps) {
  const selectedIllustration = illustration ? illustrationMap[illustration] : null;

  return (
    <div className={clsx("orbit-empty-state surface-quiet rounded-xl p-6 text-center", className)}>
      <div className="mx-auto mb-4 grid w-full max-w-40 place-items-center overflow-visible">
        {isLoading ? (
          <SatelliteLoader label="" />
        ) : selectedIllustration ? (
          <div className="aspect-[3/2] w-full">
            <img
              alt={selectedIllustration.alt}
              className="h-full w-full object-contain"
              src={selectedIllustration.src}
            />
          </div>
        ) : (
          <SpaceEmptyIllustration />
        )}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{message}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
