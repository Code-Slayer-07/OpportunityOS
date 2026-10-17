"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, signupSchema } from "@/lib/validation/schemas";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = (isSignup ? signupSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const supabase = createClient();
    try {
      if (isSignup) {
        const { name, email, password } = parsed.data as { name: string; email: string; password: string };
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (error) return setFormError(error.message);
        if (!data.session) {
          // Email confirmation is enabled in Supabase: no session until the user confirms.
          return setNotice("Check your email to confirm your account, then log in.");
        }
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page load on purpose: the session changed
        window.location.href = "/profile"; // hard navigation: a fresh session means a fresh page
      } else {
        const { email, password } = parsed.data;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return setFormError(error.message);

        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_complete")
          .eq("id", data.user.id)
          .maybeSingle();
        window.location.href = profile?.profile_complete ? "/matches" : "/profile";
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {isSignup ? "Start finding opportunities you actually qualify for." : "Log in to OpportunityOS."}
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {isSignup && <Input label="Name" name="name" autoComplete="name" error={errors.name} />}
          <Input label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            error={errors.password}
          />

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
          </Button>
        </form>

        {/* TODO(Google OAuth): add a "Continue with Google" button here. See src/app/auth/callback/route.ts. */}

        <p className="mt-6 text-center text-sm text-gray-600">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-brand-600 hover:underline">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </Card>
    </main>
  );
}
