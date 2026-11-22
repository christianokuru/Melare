import type { Metadata } from "next";
import { Quiz } from "./quiz";

export const metadata: Metadata = {
  title: "Skin Quiz · Find Your Routine for Melanin-Rich Skin",
  description: "Answer five quick questions about your skin type and concerns and get a personalised skincare routine for Black and brown skin.",
  alternates: { canonical: "/quiz" },
};

export default function QuizPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="eyebrow text-center text-muted-foreground">2-minute skin quiz</p>
      <h1 className="mt-2 text-center font-heading text-[40px] leading-none lg:text-5xl">Find your routine</h1>
      <Quiz />
    </div>
  );
}
