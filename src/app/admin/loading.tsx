// Per-page boundary so admin navigations show this instantly while the (session-gated) page streams in.
export default function Loading() {
  return <div className="h-64 animate-pulse rounded-2xl bg-sand" aria-busy aria-label="Loading" />;
}
