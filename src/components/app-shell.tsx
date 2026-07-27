import { logActivity } from "@/lib/activityLog";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  NotebookPen,
  Home,
  StickyNote,
  Pin,
  Star,
  Archive,
  Users,
  Activity,
  LogOut,
  Moon,
  Sun,
  Bell,
  Menu,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, isAdmin } from "@/lib/session";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  view?: "pinned" | "favorites" | "archived";
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home, exact: true },
  { to: "/notes", label: "All notes", icon: StickyNote },
  { to: "/notes", label: "Pinned", icon: Pin, view: "pinned" },
  { to: "/notes", label: "Favorites", icon: Star, view: "favorites" },
  { to: "/notes", label: "Archived", icon: Archive, view: "archived" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/members", label: "Members", icon: Users },
  { to: "/activity", label: "Activity", icon: Activity },
];

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initial);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchView = useRouterState({
    select: (s) => (s.location.search as { view?: string } | undefined)?.view,
  });
  const { data: session } = useSession();
  const admin = isAdmin(session?.roles);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-display text-xl font-bold">
          <NotebookPen className="text-primary" />
          Family Notes
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to && (item.view ? searchView === item.view : !searchView);
          return (
            <Link
              key={item.label}
              to={item.to as any}
              search={(item.view ? { view: item.view } : {}) as any}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
        {admin && (
          <>
            <div className="px-3 pt-5 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Family admin
            </div>
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to as any}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  pathname.startsWith(item.to)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="p-4 text-xs text-muted-foreground">
        Everything stays in your family. 🍞
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useDarkMode();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

 async function handleSignOut() {
  await logActivity("user_logged_out", "auth");

  await qc.cancelQueries();
  qc.clear();

  await supabase.auth.signOut();

  navigate({
    to: "/auth",
    replace: true,
  });
}

  const name = session?.profile.display_name ?? "Family Member";
  const role = session?.roles?.[0] ?? "member";
  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Member";

 return (
  <>
    {/* Aurora Background */}
    <div className="page-background" aria-hidden="true" />

   <div className="relative z-10 min-h-screen flex bg-background/70 backdrop-blur-sm">
      <aside
        className="
          hidden
          lg:flex
          w-72
          shrink-0
          flex-col

          bg-white/70
          dark:bg-zinc-950/70

          backdrop-blur-2xl

          border-r
          border-zinc-200/70
          dark:border-zinc-800

          shadow-[0_0_40px_rgba(0,0,0,.04)]
        "
      >
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="
            sticky
            top-0
            z-40

            border-b

            border-white/20

            bg-white/50
            dark:bg-zinc-950/40

            backdrop-blur-xl

            supports-[backdrop-filter]:bg-white/30
          "
        >
          <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-sidebar">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex-1" />

            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session?.profile.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(name)}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary" className="w-fit mt-1 text-xs">
                      {roleLabel}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className="
            flex-1
            min-w-0

            px-8
            py-8

            relative
          "
        >
          {children}
        </main>
      </div>
    </div>
    </>
  );
}
