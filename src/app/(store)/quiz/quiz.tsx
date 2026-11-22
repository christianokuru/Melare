"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitQuiz } from "@/app/actions/store";
import { CONCERNS, SKIN_TYPES } from "@/lib/constants";
import { buttonOutline, buttonPrimary, inputClass } from "@/components/site/section";
import { cn } from "@/lib/utils";

type Answers = { skinType?: string; concerns: string[]; sensitivity?: string; routine?: string; spf?: string };
const STEPS = [
  { key: "skinType", q: "How does your skin usually feel by midday?", options: SKIN_TYPES.map((t) => [t, ({ Oily: "Shiny all over", Dry: "Tight or flaky", Combination: "Oily T-zone, dry cheeks", Normal: "Comfortable, balanced", Sensitive: "Easily irritated or red" } as Record<string, string>)[t]]) },
  { key: "concerns", q: "What would you most like to improve? (choose up to 3)", multi: true, options: CONCERNS.map((c) => [c.slug, c.name]) },
  { key: "sensitivity", q: "How does your skin react to new products?", options: [["low", "Rarely reacts"], ["medium", "Sometimes stings"], ["high", "Often reacts"]] },
  { key: "routine", q: "How many steps do you want in your routine?", options: [["minimal", "Keep it simple (3)"], ["balanced", "A few more (4)"], ["full", "The full ritual (5)"]] },
  { key: "spf", q: "How often do you wear sunscreen?", options: [["daily", "Every day"], ["sometimes", "Sometimes"], ["never", "Rarely or never"]] },
] as const;

export function Quiz() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>({ concerns: [] });
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const done = step === STEPS.length;
  const cur = STEPS[step];

  const pick = (value: string) => {
    if (cur.key === "concerns") {
      const has = a.concerns.includes(value);
      setA({ ...a, concerns: has ? a.concerns.filter((c) => c !== value) : a.concerns.length < 3 ? [...a.concerns, value] : a.concerns });
    } else { setA({ ...a, [cur.key]: value }); setStep(step + 1); }
  };

  return (
    <div className="mt-8">
      <div className="mb-8 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label="Quiz progress">
        <div className="h-full bg-foreground transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>
      {!done ? (
        <fieldset>
          <legend className="mb-6 text-center font-heading text-2xl lg:text-3xl">{cur.q}</legend>
          <div className="grid gap-3">
            {cur.options.map(([value, label]) => {
              const on = cur.key === "concerns" ? a.concerns.includes(value) : a[cur.key as "skinType"] === value;
              return (
                <button key={value} type="button" aria-pressed={on} onClick={() => pick(value)}
                  className={cn("flex min-h-14 items-center justify-between rounded-2xl border px-5 text-left transition-colors", on ? "border-foreground bg-foreground text-background" : "border-foreground/20 hover:border-foreground")}>
                  <span>{cur.key === "skinType" ? <><strong className="font-medium">{value}</strong> · {label}</> : label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-between">
            <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="text-sm underline underline-offset-4 disabled:invisible">Back</button>
            {cur.key === "concerns" && <button type="button" disabled={!a.concerns.length} onClick={() => setStep(step + 1)} className={buttonPrimary}>Next</button>}
          </div>
        </fieldset>
      ) : (
        <form className="mx-auto grid max-w-md gap-4 text-center" onSubmit={(e) => {
          e.preventDefault();
          setError("");
          start(async () => {
            const r = await submitQuiz({ ...(a as Required<Answers>), email } as Parameters<typeof submitQuiz>[0]);
            if (r.ok) router.push(`/quiz/results?p=${r.slugs.join(",")}`); else setError(r.error);
          });
        }}>
          <p className="font-heading text-2xl">Your routine is ready ✦</p>
          <p className="text-sm text-muted-foreground">Want a copy in your inbox, plus 10% off your first order? (Optional)</p>
          <label htmlFor="q-email" className="sr-only">Email (optional)</label>
          <input id="q-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className={inputClass} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Building your routine…" : "See my routine"}</button>
          <button type="button" onClick={() => setStep(0)} className={buttonOutline}>Start over</button>
        </form>
      )}
    </div>
  );
}
