"use client";
import { adminButton } from "@/components/admin/ui";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className={adminButton}>Print</button>;
}
