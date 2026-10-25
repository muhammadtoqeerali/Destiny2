import clsx from "clsx";

export default function StatCard({
  label,
  value,
  sub,
  accent = "fjord",
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "fjord" | "teal" | "amber" | "rose";
  delay?: number;
}) {
  return (
    <div
      className="rounded-xl2 bg-white border border-fjord-100 shadow-card p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-fjord-700/60 mb-2">
        {label}
      </div>
      <div
        className={clsx(
          "text-2xl font-semibold tracking-tight",
          accent === "fjord" && "text-fjord-900",
          accent === "teal" && "text-teal-700",
          accent === "amber" && "text-amber-600",
          accent === "rose" && "text-rose-600"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-fjord-700/55 mt-1">{sub}</div>}
    </div>
  );
}
