"use client";
import { useTransition } from "react";
import { toastResult } from "@/lib/toast-result";
import { moderateReview } from "@/app/actions/admin";

export function ReviewActions({ id, approved }: { id: string; approved: boolean }) {
  const [pending, start] = useTransition();
  const run = (a: "approve" | "hide" | "delete") => start(async () => { const r = await moderateReview(id, a); toastResult(r, "Updated"); });
  return (
    <div className="mt-3 flex gap-4 text-xs">
      <button type="button" disabled={pending} onClick={() => run(approved ? "hide" : "approve")} className="underline">{approved ? "Unpublish" : "Approve"}</button>
      <button type="button" disabled={pending} onClick={() => confirm("Delete this review?") && run("delete")} className="text-destructive underline">Delete</button>
    </div>
  );
}
