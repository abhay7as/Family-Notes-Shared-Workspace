import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotebookPen, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Family Notes" },
      { name: "description", content: "Sign in to your family's shared notebook." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email");
const passwordSchema = z.string().min(8, "At least 8 characters");
async function logActivity(
  action: string,
  targetType: string,
  targetId?: string,
  metadata: Record<string, any> = {}
) {
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes.user) return;

  await supabase.from("activity_log").insert({
    actor_id: userRes.user.id,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata,
  });
}
function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const form = new FormData(e.currentTarget);

  const email = emailSchema.safeParse(form.get("email"));
  const password = passwordSchema.safeParse(form.get("password"));

  if (!email.success) {
    return toast.error(email.error.issues[0].message);
  }

  if (!password.success) {
    return toast.error(password.error.issues[0].message);
  }

  setLoading(true);

  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  setLoading(false);

  if (error) {
    return toast.error(error.message);
  }

  // Log successful sign in
  await logActivity("user_logged_in", "auth");


toast.success("Welcome back!");

navigate({
  to: "/dashboard",
  replace: true,
});
}

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    const email = emailSchema.safeParse(form.get("email"));
    const password = passwordSchema.safeParse(form.get("password"));
    if (!name) return toast.error("Please enter your name");
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your inbox to confirm.");
  }

  async function handleForgot() {
    const email = window.prompt("Enter your email to receive a reset link:");
    if (!email) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) return toast.error(error.message);
    toast.success("Reset link sent. Check your email.");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-accent/40">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
          <NotebookPen className="text-primary" />
          Family Notes
        </Link>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight text-foreground">
            A shared notebook that feels like home.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Grocery lists, birthday plans, recipes, the babysitter's number — everyone in the family, one warm little app.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Private to your family. Real-time. Installable on any phone.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader>
            <div className="lg:hidden flex items-center gap-2 mb-2 font-display text-xl font-bold">
              <NotebookPen className="text-primary" /> Family Notes
            </div>
            <CardTitle className="font-display text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in or create the very first family account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form className="space-y-3" onSubmit={handleSignIn}>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" autoComplete="current-password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : "Sign in"}
                  </Button>
                  <button type="button" onClick={handleForgot} className="text-sm text-muted-foreground hover:text-primary block mx-auto">
                    Forgot password?
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form className="space-y-3" onSubmit={handleSignUp}>
                  <div className="space-y-1">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" name="name" required maxLength={60} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email2">Email</Label>
                    <Input id="email2" name="email" type="email" autoComplete="email" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="password2">Password</Label>
                    <Input id="password2" name="password" type="password" autoComplete="new-password" required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : "Create account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    The first person to register becomes the family's Super Admin.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}