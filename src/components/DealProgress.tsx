import { dealProgress, offPathFlag, type ProgressSignals } from '@/lib/progress';

// Horizontal progress tracker of green dots that fill in as a deal advances.
// Each stage is computed from the deal's real data (see lib/progress.ts).
export function DealProgress(props: ProgressSignals) {
  const stages = dealProgress(props);
  const flag = offPathFlag(props.status);
  return (
    <section className="card p-5">
      {flag && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className={`badge ${flag.cls}`}>{flag.label}</span>
          <span className="text-gray-500">This deal is currently off the normal track.</span>
        </div>
      )}
      {/* min-w-0 lets the 7 steps share the width and shrink to fit any screen
          (no more running off the right edge on a phone). */}
      <div className="flex items-start">
        {stages.map((st, i) => {
          const prevDone = i > 0 && stages[i - 1].done;
          return (
            <div key={st.key} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : prevDone ? 'bg-green-500' : 'bg-gray-200'}`} />
                <div
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 text-[11px] font-bold sm:h-7 sm:w-7 sm:text-xs ${
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
              <span className={`mt-1.5 px-0.5 text-center text-[10px] leading-tight sm:mt-2 sm:text-xs ${st.done ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
