import { dealProgress, type ProgressSignals } from '@/lib/progress';

// Horizontal progress tracker of green dots that fill in as a deal advances.
// Each stage is computed from the deal's real data (see lib/progress.ts).
export function DealProgress(props: ProgressSignals) {
  const stages = dealProgress(props);
  return (
    <section className="card p-5">
      <div className="flex items-start overflow-x-auto">
        {stages.map((st, i) => {
          const prevDone = i > 0 && stages[i - 1].done;
          return (
            <div key={st.key} className="flex min-w-[80px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : prevDone ? 'bg-green-500' : 'bg-gray-200'}`} />
                <div
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-xs font-bold ${
                    st.done
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white text-gray-300'
                  }`}
                  aria-hidden
                >
                  {st.done ? '✓' : i + 1}
                </div>
                <div className={`h-0.5 flex-1 ${i === stages.length - 1 ? 'opacity-0' : st.done ? 'bg-green-500' : 'bg-gray-200'}`} />
              </div>
              <span className={`mt-2 text-center text-xs leading-tight ${st.done ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
