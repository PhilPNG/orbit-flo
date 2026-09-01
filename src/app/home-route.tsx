/**
 * "/" is the only route that branches on auth state instead of requiring it:
 * signed-out visitors get the storefront, signed-in users get exactly the
 * redirect they always got - including WorkspaceRedirect's pending-invitation
 * handling, which lives in that component untouched.
 */
import { lazy, Suspense } from "react";
import { SatelliteLoader, StarFieldBackground } from "../components/space-visuals";
import { useAuth } from "../features/auth/use-auth";
import { WorkspaceRedirect } from "../features/workspaces/workspace-redirect";
import { loadLandingPage } from "./route-loaders";

const LandingPage = lazy(loadLandingPage);

function HomeLoader() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6">
      <StarFieldBackground />
      <div className="relative z-10">
        <SatelliteLoader label="Preparing your orbit" />
      </div>
    </main>
  );
}

export function HomeRoute() {
  const { isLoading, user } = useAuth();

  if (isLoading) return <HomeLoader />;
  if (user) return <WorkspaceRedirect />;

  return (
    <Suspense fallback={<HomeLoader />}>
      <LandingPage />
    </Suspense>
  );
}
