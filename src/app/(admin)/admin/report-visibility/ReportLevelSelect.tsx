'use client';

import { setReportVisibilityAction } from '@/app/(admin)/actions';

/** Auto-submitting visibility dropdown for one report row. */
export function ReportLevelSelect({
  reportKey,
  level,
  levels,
}: {
  reportKey: string;
  level: string;
  levels: { value: string; label: string }[];
}) {
  return (
    <form action={setReportVisibilityAction}>
      <input type="hidden" name="key" value={reportKey} />
      <select
        name="level"
        defaultValue={level}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input text-sm"
      >
        {levels.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn-secondary ml-2 text-xs">Save</button>
      </noscript>
    </form>
  );
}
