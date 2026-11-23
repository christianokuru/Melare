"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { placeOrder, quoteCheckout, type Quote } from "@/app/actions/checkout";
import { COUNTRIES, NG_STATES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { track } from "@/lib/track";
import { buttonPrimary, inputClass, labelClass } from "@/components/site/section";
import { cn } from "@/lib/utils";

type Addr = { fullName: string; phone: string; line1: string; line2: string; city: string; state: string; country: string; postalCode: string };
type Props = {
  email: string | null;
  initial: Addr;
  lines: { id: string; name: string; label: string; quantity: number; totalNgn: number; totalUsd: number }[];
  browsingCurrency: "NGN" | "USD";
  initialQuote: Quote;
};

export function CheckoutForm({ email, initial, lines, browsingCurrency, initialQuote }: Props) {
  const [addr, setAddr] = useState(initial);
  const [buyerEmail, setBuyerEmail] = useState(email ?? "");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote>(initialQuote);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, start] = useTransition();
  const [quoting, startQuote] = useTransition();
  const tracked = useRef(false);

  // Charged in the delivery country's currency (Nigeria → ₦, elsewhere → $); the quote says which.
  const currency = quote.currency;
  const lineTotal = (l: Props["lines"][number]) => (currency === "NGN" ? l.totalNgn : l.totalUsd);
  const refresh = useCallback((next: { country: string; state: string; code?: string }) => startQuote(async () => {
    const q = await quoteCheckout({ ...next, phone: addr.phone });
    if ("error" in q) setFormError(q.error); else setQuote(q);
  }), [addr.phone]);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const c = initialQuote.currency;
    track("begin_checkout", c, initialQuote.subtotal / 100, lines.map((l) => ({ item_id: l.id, item_name: l.name, price: (c === "NGN" ? l.totalNgn : l.totalUsd) / 100 / l.quantity, quantity: l.quantity })));
  }, [initialQuote, lines]);

  const field = (k: keyof Addr, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={props.className}>
      <label htmlFor={k} className={labelClass}>{label}</label>
      <input id={k} name={k} value={addr[k]} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined}
        onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} className={inputClass} {...props} />
      {errors[k] && <p id={`${k}-err`} className="mt-1 text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    start(async () => {
      const r = await placeOrder({ ...addr, email: buyerEmail, code: quote.codeApplied ?? "", saveAddress: !!email });
      // On success the server redirects to Flutterwave; we only get here on errors.
      if (r?.error) { setFormError(r.error); setErrors(r.fields ?? {}); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  };

  const isNg = addr.country === "NG";
  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <div className="grid gap-8">
        {formError && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{formError}</p>}
        <section className="grid gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-2xl">Contact</h2>
            {!email && <Link href="/sign-in?next=/checkout" className="text-sm underline underline-offset-4">Sign in</Link>}
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input id="email" type="email" required autoComplete="email" value={buyerEmail} readOnly={!!email} aria-invalid={!!errors.email}
              onChange={(e) => setBuyerEmail(e.target.value)} className={cn(inputClass, email && "bg-muted")} />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            <p className="mt-1 text-xs text-muted-foreground">We’ll send your receipt and delivery updates here.</p>
          </div>
        </section>
        <section className="grid gap-4">
          <h2 className="font-heading text-2xl">Delivery address</h2>
          {field("fullName", "Full name", { autoComplete: "name", required: true })}
          {field("phone", "Phone (for the courier)", { autoComplete: "tel", type: "tel", inputMode: "tel", required: true, placeholder: "+234 801 234 5678" })}
          <div>
            <label htmlFor="country" className={labelClass}>Country</label>
            <select id="country" value={addr.country} autoComplete="country" className={inputClass}
              onChange={(e) => { const next = { ...addr, country: e.target.value, state: "" }; setAddr(next); refresh({ country: next.country, state: "", code }); }}>
              {Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {field("line1", "Address", { autoComplete: "address-line1", required: true, placeholder: "House number and street" })}
          {field("line2", "Apartment, landmark (optional)", { autoComplete: "address-line2" })}
          <div className="grid grid-cols-2 gap-3">
            {field("city", "City / area", { autoComplete: "address-level2", required: true })}
            <div>
              <label htmlFor="state" className={labelClass}>{isNg ? "State" : "State / region"}</label>
              {isNg ? (
                <select id="state" value={addr.state} required aria-invalid={!!errors.state} className={inputClass}
                  onChange={(e) => { setAddr({ ...addr, state: e.target.value }); refresh({ country: addr.country, state: e.target.value, code }); }}>
                  <option value="">Select…</option>
                  {NG_STATES.map((st) => <option key={st}>{st}</option>)}
                </select>
              ) : (
                <input id="state" value={addr.state} aria-invalid={!!errors.state} className={inputClass}
                  onChange={(e) => setAddr({ ...addr, state: e.target.value })} onBlur={() => refresh({ country: addr.country, state: addr.state, code })} />
              )}
              {errors.state && <p className="mt-1 text-xs text-destructive">{errors.state}</p>}
            </div>
          </div>
          {!isNg && field("postalCode", "Postal / ZIP code", { autoComplete: "postal-code" })}
        </section>
      </div>

      <aside className="h-fit rounded-2xl border p-6 lg:sticky lg:top-24">
        <h2 className="font-heading text-2xl">Order summary</h2>
        <ul className="mt-4 grid gap-2 border-b pb-4 text-sm">
          {lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span className="min-w-0">{l.name} <span className="text-muted-foreground">· {l.label} × {l.quantity}</span></span><span>{formatMoney(lineTotal(l), currency)}</span></li>)}
        </ul>
        {currency !== browsingCurrency && <p className="mt-3 rounded-xl bg-blush p-3 text-xs">{currency === "NGN" ? "Orders delivered in Nigeria are charged in naira." : "Orders delivered outside Nigeria are charged in US dollars."}</p>}
        <div className="mt-4">
          <label htmlFor="code" className={labelClass}>Promo or referral code</label>
          {email ? (
            <>
              <div className="flex gap-2">
                <input id="code" value={code} maxLength={32} onChange={(e) => setCode(e.target.value.toUpperCase())} className={cn(inputClass, "uppercase")} />
                <button type="button" disabled={!code || quoting} onClick={() => refresh({ country: addr.country, state: addr.state, code })} className="h-12 shrink-0 rounded-xl border border-foreground px-4 text-xs uppercase tracking-[0.1em] disabled:opacity-40">Apply</button>
              </div>
              {quote.codeError && <p className="mt-1 text-xs text-destructive">{quote.codeError}</p>}
              {quote.codeApplied && <p className="mt-1 text-xs text-[#3c6b3c]">Code {quote.codeApplied} applied</p>}
            </>
          ) : <p className="text-sm text-muted-foreground"><Link href="/sign-in?next=/checkout" className="text-foreground underline underline-offset-4">Sign in</Link> to use a promo or referral code.</p>}
        </div>
        <dl className={cn("mt-4 grid gap-2 text-sm", quoting && "opacity-60")}>
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(quote.subtotal, currency)}</dd></div>
          {quote.discount > 0 && <div className="flex justify-between text-[#3c6b3c]"><dt>Discount</dt><dd>−{formatMoney(quote.discount, currency)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery {quote.zone && <span className="text-muted-foreground">({quote.zone}, {quote.eta})</span>}</dt><dd>{quote.shipping === 0 ? "Free" : formatMoney(quote.shipping, currency)}</dd></div>
          <div className="mt-2 flex justify-between border-t pt-3 text-base"><dt>Total</dt><dd>{formatMoney(quote.total, currency)}</dd></div>
        </dl>
        <button type="submit" disabled={pending || quoting} className={cn(buttonPrimary, "mt-6 w-full")}>{pending ? "Securing your order…" : `Pay ${formatMoney(quote.total, currency)}`}</button>
        <p className="mt-3 text-center text-xs text-muted-foreground">You’ll complete payment securely with Flutterwave: {currency === "NGN" ? "card, bank transfer or USSD" : "card"}. Items are reserved for 30 minutes.</p>
      </aside>
    </form>
  );
}
