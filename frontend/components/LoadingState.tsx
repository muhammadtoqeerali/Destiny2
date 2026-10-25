export default function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-fjord-100" />
          <div className="absolute inset-0 rounded-full border-2 border-fjord-500 border-t-transparent animate-spin" />
        </div>
        <span className="text-sm text-fjord-700/60">{label}</span>
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl2 border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 max-w-xl mx-auto my-12">
      <p className="font-medium mb-1">Couldn&apos;t load this data.</p>
      <p className="text-rose-700/80">{message}</p>
      <p className="text-rose-700/60 mt-3 text-xs">
        Make sure the backend is running and the pipeline has been run:{" "}
        <code className="bg-rose-100 px-1 py-0.5 rounded">
          python data/generate_dataset.py && python data/preprocess.py && python
          backend/app/ml/train.py
        </code>
      </p>
    </div>
  );
}
