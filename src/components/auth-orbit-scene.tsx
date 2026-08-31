import { Orb } from "./orb";

// These four labels are the only thing on the sign-in page that says what this
// product does. They are content, not decoration - the orb replaced the rings
// and the core artwork, not these.
const satellites = [
  { label: "Plan", className: "auth-orbit-satellite-one", tone: "cyan" },
  { label: "Brainstorm", className: "auth-orbit-satellite-two", tone: "blue" },
  { label: "Mind map", className: "auth-orbit-satellite-three", tone: "violet" },
  { label: "Review", className: "auth-orbit-satellite-four", tone: "cyan" },
];

export function AuthOrbitScene() {
  return (
    <div aria-hidden="true" className="auth-orbit-scene mt-6" data-testid="auth-orbit-scene">
      <Orb />
      {satellites.map((satellite) => (
        <div className={`auth-orbit-card ${satellite.className}`} key={satellite.label}>
          <span className={`auth-orbit-card-dot auth-orbit-card-dot-${satellite.tone}`} />
          <span>{satellite.label}</span>
        </div>
      ))}
    </div>
  );
}
