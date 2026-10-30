"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isLogin = mode === "login";

  return (
    <Card className="w-full max-w-sm gap-6 p-2 shadow-sm sm:p-4">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">{isLogin ? "Log in" : "Create your account"}</CardTitle>
        <CardDescription>
          {isLogin ? "Welcome back. Pick up where you left off." : "Use an email and a password of at least 8 characters."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          {state?.message && <p className="text-sm text-success">{state.message}</p>}
          <Button type="submit" disabled={pending} className="h-10 text-sm">
            {pending ? "Please wait..." : isLogin ? "Log in" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "No account? " : "Already have an account? "}
            <Link href={isLogin ? "/signup" : "/login"} className="font-medium text-primary underline underline-offset-4">
              {isLogin ? "Create one" : "Log in"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
