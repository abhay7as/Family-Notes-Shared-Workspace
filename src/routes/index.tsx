import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center">
        <div className="font-display text-3xl font-bold text-foreground">Family Notes</div>
        <div className="text-sm text-muted-foreground mt-1">Loading…</div>
      </div>
    </div>
  );
}
