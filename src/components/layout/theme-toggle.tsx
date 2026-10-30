"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

// The theme is the "dark" class on <html>. It is saved in localStorage, and the first visit follows the system.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage is blocked. The theme still changes for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {label && (dark ? "Light mode" : "Dark mode")}
    </button>
  );
}
