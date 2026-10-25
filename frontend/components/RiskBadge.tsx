import clsx from "clsx";

export function riskTier(probability: number): "low" | "moderate" | "high" {
  if (probability >= 0.5) return "high";
  if (probability >= 0.25) return "moderate";
  return "low";
}

const LABELS: Record<string, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
};

export default function RiskBadge({
  probability,
  size = "md",
}: {
  probability: number;
  size?: "sm" | "md" | "lg";
}) {
  const tier = riskTier(probability);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-xs",
        size === "lg" && "px-3.5 py-1.5 text-sm",
        tier === "low" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
        tier === "moderate" && "bg-amber-50 text-amber-700 border border-amber-200",
        tier === "high" && "bg-rose-50 text-rose-700 border border-rose-200"
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          tier === "low" && "bg-risk-low",
          tier === "moderate" && "bg-risk-moderate",
          tier === "high" && "bg-risk-high"
        )}
      />
      {LABELS[tier]} · {(probability * 100).toFixed(0)}%
    </span>
  );
}
