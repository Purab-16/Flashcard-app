"use client";

import { FileText, Highlighter, Layers, LayoutDashboard, LogOut, Timer, ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/review", label: "Review", icon: Layers },
  { href: "/mock", label: "Mock test", icon: Timer },
  { href: "/stats", label: "Stats", icon: ChartNoAxesColumn },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
        <Highlighter className="size-4" aria-hidden />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">Flashcard App</span>
    </Link>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Phone: slim top bar and a tab bar at the bottom */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-sidebar text-sidebar-foreground md:hidden"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                active ? "font-semibold text-sidebar-primary" : "text-sidebar-foreground/70"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: ink sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-8">
          <div className="px-2">
            <Brand />
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-sidebar-primary" aria-hidden />}
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-1">
          <ThemeToggle
            label
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          />
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
