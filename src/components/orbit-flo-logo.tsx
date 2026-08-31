import { clsx } from "clsx";
import { orbitAssets } from "../lib/orbit-assets";

type OrbitFloLogoVariant = "full" | "mark" | "wordmark";
type OrbitFloLogoTheme = "dark" | "light";

type OrbitFloLogoProps = {
  variant?: OrbitFloLogoVariant;
  theme?: OrbitFloLogoTheme;
  showTagline?: boolean;
  className?: string;
};

function OrbitFloMark({ className }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      data-testid="orbitflo-logo-mark"
      className={clsx(
        "h-full w-full rounded-lg object-contain drop-shadow-[0_8px_18px_rgba(2,8,23,0.48)]",
        className,
      )}
      height="512"
      src={orbitAssets.brand.mark}
      width="512"
    />
  );
}

export function OrbitFloLogo({
  variant = "full",
  theme = "dark",
  showTagline = false,
  className,
}: OrbitFloLogoProps) {
  const isLight = theme === "light";
  const lockupSrc = isLight ? orbitAssets.brand.lockupLight : orbitAssets.brand.lockupDark;
  const wordmarkSrc = isLight ? orbitAssets.brand.wordmarkLight : orbitAssets.brand.wordmarkDark;

  if (variant === "mark") {
    return (
      <div aria-label="Orbit Flo" className={clsx("aspect-square w-12", className)} role="img">
        <OrbitFloMark />
      </div>
    );
  }

  if (variant === "wordmark") {
    return (
      <div
        aria-label="Orbit Flo"
        className={clsx("inline-flex min-w-0 items-center", className)}
        role="img"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-auto w-full object-contain"
          height="150"
          src={wordmarkSrc}
          width="640"
        />
      </div>
    );
  }

  return (
    <div
      aria-label="Orbit Flo"
      className={clsx("inline-flex w-full max-w-56 min-w-0 flex-col", className)}
      role="img"
    >
      <img
        alt=""
        aria-hidden="true"
        className="h-auto w-full rounded-lg object-contain drop-shadow-[0_10px_22px_rgba(2,8,23,0.4)]"
        height="360"
        src={lockupSrc}
        width="960"
      />
      {showTagline ? (
        <p
          className={clsx(
            "mt-1 text-[0.62rem] font-bold uppercase tracking-[0.24em]",
            isLight ? "text-slate-500" : "text-slate-400",
          )}
        >
          FOCUS. FLOW. FINISH.
        </p>
      ) : null}
    </div>
  );
}
