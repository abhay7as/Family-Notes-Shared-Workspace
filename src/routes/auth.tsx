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

// Key used to cache the family name a user chose at signup, so that when
// they come back after verifying their email, we can create their family
// with the right name instead of a hardcoded placeholder.
function pendingFamilyNameKey(email: string) {
  return `pending_family_name:${email.toLowerCase()}`;
}

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

async function createFamily(familyName: string, displayName: string) {
  const { error } = await supabase.functions.invoke("create-family", {
    body: {
      familyName,
      displayName,
    },
  });

  if (error) {
    toast.error(error.message);
    return false;
  }

  return true;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // When a user logs in for the first time (family_id is still null) and we
  // have no cached family name for them, we pause the sign-in flow and ask
  // for a family name here instead of silently creating "My Family".
  const [pendingSignIn, setPendingSignIn] = useState<{ displayName: string } | null>(null);
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [creatingFamily, setCreatingFamily] = useState(false);

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

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  setLoading(false);
  return toast.error("User not found");
}

const { data: profile } = await supabase
  .from("profiles")
  .select("family_id, display_name")
  .eq("id", user.id)
  .single();

    if (profile && !profile.family_id) {
      const cachedFamilyName = window.localStorage.getItem(
        pendingFamilyNameKey(email.data)
      );

      if (cachedFamilyName) {
        // We know what family name they chose at signup — create it now.
        const ok = await createFamily(cachedFamilyName, profile.display_name ?? "");
        window.localStorage.removeItem(pendingFamilyNameKey(email.data));

        if (!ok) {
          setLoading(false);
          return;
        }
      } else {
        // No cached name (different device/browser, cache cleared, etc).
        // Ask the user instead of guessing.
        setLoading(false);
        setPendingSignIn({ displayName: profile.display_name ?? "" });
        return;
      }
    }

    setLoading(false);

    await logActivity("user_logged_in", "auth");

    toast.success("Welcome back!");

    navigate({
      to: "/dashboard",
      replace: true,
    });
  }

  async function handleCreateFamilySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!pendingSignIn) return;

    const familyName = familyNameInput.trim().slice(0, 80);

    if (!familyName) {
      return toast.error("Please enter your family name");
    }

    setCreatingFamily(true);

    const ok = await createFamily(familyName, pendingSignIn.displayName);

    setCreatingFamily(false);

    if (!ok) return;

    setPendingSignIn(null);
    setFamilyNameInput("");

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

    const familyName = String(form.get("familyName") ?? "")
      .trim()
      .slice(0, 80);

    if (!familyName) {
      return toast.error("Please enter your family name");
    }

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
        data: {
          display_name: name,
        },
      },
    });

    setLoading(false);

    if (error) {
      return toast.error(error.message);
    }

    // Cache the family name they chose so that when they come back after
    // verifying their email and log in, we create the family with this
    // name instead of a hardcoded placeholder.
    window.localStorage.setItem(pendingFamilyNameKey(email.data), familyName);

    toast.success(
      "Account created! Please verify your email, then sign in to finish setting up your family."
    );

    // Do NOT navigate and do NOT show a second "Family created" toast here —
    // the family isn't created yet. That happens on first sign-in, once the
    // email is verified, using the cached family name above (or the
    // "name your family" dialog if that cache is missing).
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
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-2xl font-bold text-foreground"
        >
          <NotebookPen className="text-primary" />
          Family Notes
        </Link>

        <div>
          <h1 className="font-display text-5xl font-bold leading-tight text-foreground">
            A shared notebook that feels like home.
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            Grocery lists, birthday plans, recipes, the babysitter's number —
            everyone in the family, one warm little app.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Private to your family. Real-time. Installable on any phone.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader>
            <div className="lg:hidden flex items-center gap-2 mb-2 font-display text-xl font-bold">
              <NotebookPen className="text-primary" />
              Family Notes
            </div>

            <CardTitle className="font-display text-2xl">
              Welcome
            </CardTitle>

            <CardDescription>
              Sign in or create the very first family account.
            </CardDescription>
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
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      "Sign in"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-sm text-muted-foreground hover:text-primary block mx-auto"
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-3" onSubmit={handleSignUp}>
                  <div className="space-y-1">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      maxLength={60}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="familyName">Family Name</Label>
                    <Input
                      id="familyName"
                      name="familyName"
                      placeholder="e.g. Dangwal Family"
                      required
                      maxLength={80}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="email2">Email</Label>
                    <Input
                      id="email2"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="password2">Password</Label>
                    <Input
                      id="password2"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      "Create account"
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    The first person to register becomes the family's Super
                    Admin.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {pendingSignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-xl">
                Name your family
              </CardTitle>
              <CardDescription>
                One last step — what should we call your family's space?
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-3" onSubmit={handleCreateFamilySubmit}>
                <div className="space-y-1">
                  <Label htmlFor="setupFamilyName">Family name</Label>
                  <Input
                    id="setupFamilyName"
                    name="setupFamilyName"
                    value={familyNameInput}
                    onChange={(e) => setFamilyNameInput(e.target.value)}
                    placeholder="e.g. Dangwal Family"
                    maxLength={80}
                    autoFocus
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={creatingFamily}
                >
                  {creatingFamily ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Create family"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
