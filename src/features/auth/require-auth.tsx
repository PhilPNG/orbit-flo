import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { SatelliteLoader, StarFieldBackground } from "../../components/space-visuals";
import { useAuth } from "./use-auth";

export function RequireAuth({ children }: PropsWithChildren) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020817] px-6">
        <StarFieldBackground />
        <div className="relative z-10">
          <SatelliteLoader label="Preparing your orbit" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
