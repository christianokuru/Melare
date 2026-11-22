"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

/** Signs out this device, or every device with `everywhere`. */
export function SignOutButton({ everywhere, className, children = "Sign out" }: { everywhere?: boolean; className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={className} onClick={() => start(async () => {
      await (everywhere ? authClient.revokeSessions() : authClient.signOut());
      router.push(everywhere ? "/sign-in" : "/");
      router.refresh();
    })}>{pending ? "Signing out…" : children}</button>
  );
}
