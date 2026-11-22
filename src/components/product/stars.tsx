import { StarIcon } from "@/components/site/icons";

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex text-gold" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} width={size} height={size} filled={rating >= i - 0.25} />)}
    </span>
  );
}
