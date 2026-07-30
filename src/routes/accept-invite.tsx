import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Join your family — Family Notes" }] }),
  component: AcceptInvitePage,
});

type Stage = "checking" | "no_session" | "set_password" | "success" | "error";

function AcceptInvitePage() {
  const navigate = useNavigate();
  const [, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setSession(data.session);
        setStage("set_password");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      setStage(newSession ? "set_password" : "no_session");
    });

    const timeout = setTimeout(() => {
      setStage((current) => (current === "checking" ? "no_session" : current));
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      setStage("error");
      toast.error(error.message);
      return;
    }

    setStage("success");
    toast.success("Welcome to the family!");
    setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-accent/20">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Join your family</CardTitle>
          <CardDescription>Set a password to finish joining Family Notes</CardDescription>
        </CardHeader>

        <CardContent>
          {stage === "checking" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking your invite…</p>
            </div>
          )}

          {stage === "no_session" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="font-medium">This invite link is invalid or has expired.</p>
              <p className="text-sm text-muted-foreground">
                Ask a family admin to send you a new invite.
              </p>
            </div>
          )}

          {stage === "set_password" && (
            <form className="space-y-4" onSubmit={handleSetPassword}>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join family"}
              </Button>
            </form>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="font-medium">You're in! Redirecting…</p>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="font-medium">{errorMessage}</p>
              <Button variant="outline" onClick={() => setStage("set_password")}>
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}