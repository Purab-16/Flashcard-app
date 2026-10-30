import { Suspense } from "react";
import { AppNav } from "@/components/layout/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      {/* usePathname needs Suspense. The fallback keeps the sidebar's space so the page does not jump. */}
      <Suspense fallback={<aside className="hidden h-screen w-60 shrink-0 bg-sidebar md:block" aria-hidden />}>
        <AppNav />
      </Suspense>
      <div className="paper min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
    </div>
  );
}
