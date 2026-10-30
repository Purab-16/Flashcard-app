import { Highlighter } from "lucide-react";
import { CardStack } from "@/components/shared/card-stack";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
            <Highlighter className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight text-white">Flashcard App</span>
        </div>
        <div className="flex max-w-md flex-col gap-6">
          <CardStack className="origin-left scale-125" />
          <p className="font-heading text-4xl leading-tight font-semibold tracking-tight text-white">
            Turn your own notes into{" "}
            <span className="rounded bg-highlight px-1.5 text-highlight-foreground">practice questions</span>.
          </p>
          <p className="text-sidebar-foreground/75">
            Upload a PDF or a photo of your notes. Answer questions, see exactly where in your notes each answer comes
            from, and come back to what you missed.
          </p>
        </div>
        <p className="text-sm text-sidebar-foreground/60">Your files stay private to your account.</p>
      </aside>
      <main className="relative flex items-center justify-center p-4 sm:p-8">
        <ThemeToggle className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" />
        {children}
      </main>
    </div>
  );
}
