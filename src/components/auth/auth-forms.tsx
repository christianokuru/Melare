"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient, safeNext } from "@/lib/auth-client";
import { buttonOutline, buttonPrimary, inputClass, labelClass } from "@/components/site/section";

const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";

function Field({ id, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return <div><label htmlFor={id} className={labelClass}>{label}</label><input id={id} name={id} className={inputClass} {...props} /></div>;
}

function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl p-4 text-sm ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-blush"}`}>{children}</p>;
}

function GoogleButton({ next }: { next: string }) {
  if (!GOOGLE) return null;
  return (
    <>
      <button type="button" className={buttonOutline} onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}>Continue with Google</button>
      <p className="text-center text-xs text-muted-foreground">or</p>
    </>
  );
}

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      setError(""); setInfo("");
      start(async () => {
        const { error } = await authClient.signIn.email({ email: String(f.get("email")), password: String(f.get("password")), callbackURL: next });
        if (!error) { router.push(next); router.refresh(); return; }
        if (error.status === 403) setInfo("Please confirm your email first. We’ve just sent you a new link.");
        else if (error.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
        else setError("Incorrect email or password.");
      });
    }}>
      <GoogleButton next={next} />
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="ok">{info}</Notice>}
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <Field id="password" label="Password" type="password" autoComplete="current-password" required />
      <Link href="/forgot-password" className="-mt-2 justify-self-end text-xs underline underline-offset-4">Forgot password?</Link>
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-center text-sm text-muted-foreground">New to Melaré? <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className="text-foreground underline underline-offset-4">Create an account</Link></p>
    </form>
  );
}

export function SignUpForm() {
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [pending, start] = useTransition();
  if (sent) return <Notice tone="ok">Almost there! We’ve sent a confirmation link to <strong>{sent}</strong>. Open it to activate your account.</Notice>;
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const email = String(f.get("email")).trim().toLowerCase();
      const password = String(f.get("password"));
      setError("");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      start(async () => {
        const { error } = await authClient.signUp.email({ name: String(f.get("name")).trim().slice(0, 80), email, password, callbackURL: next });
        if (!error) return setSent(email);
        setError(error.status === 429 ? "Too many attempts. Please try again later." : error.message ?? "We couldn’t create your account. Please try again.");
      });
    }}>
      <GoogleButton next={next} />
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="name" label="Full name" autoComplete="name" required minLength={2} maxLength={80} />
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <Field id="password" label="Password (8+ characters)" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-xs text-muted-foreground">By creating an account you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.</p>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-foreground underline underline-offset-4">Sign in</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <Notice tone="ok">If an account exists for that email, we’ve sent a link to reset your password. It expires in 30 minutes.</Notice>;
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const email = String(new FormData(e.currentTarget).get("email"));
      start(async () => { await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }); setSent(true); });
    }}>
      <Field id="email" label="Email" type="email" autoComplete="email" required />
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Sending…" : "Send reset link"}</button>
      <Link href="/sign-in" className="text-center text-sm underline underline-offset-4">Back to sign in</Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState(params.get("error") ? "This reset link is invalid or has expired." : "");
  const [pending, start] = useTransition();
  if (!token) return <Notice tone="error">This reset link is invalid or has expired. <Link href="/forgot-password" className="underline">Request a new one</Link>.</Notice>;
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const a = String(f.get("password")), b = String(f.get("confirm"));
      if (a.length < 8) return setError("Use at least 8 characters.");
      if (a !== b) return setError("Passwords don’t match.");
      start(async () => {
        const { error } = await authClient.resetPassword({ newPassword: a, token });
        if (error) setError("This reset link is invalid or has expired.");
        else router.push("/sign-in?reset=1");
      });
    }}>
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="password" label="New password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      <Field id="confirm" label="Confirm new password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
