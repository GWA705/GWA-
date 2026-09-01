'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { guustoTestAction, type ActionState } from '@/app/(admin)/actions';

function SendBtn({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || disabled}>
      {pending ? 'Sending…' : 'Send test call'}
    </button>
  );
}

export function GuustoTestForm({ defaultBase, candidate, disabled }: { defaultBase: string; candidate: string; disabled: boolean }) {
  const [state, action] = useFormState(guustoTestAction, {} as ActionState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr]">
        <div>
          <label className="label" htmlFor="base">API base URL</label>
          <input id="base" name="base" defaultValue={defaultBase} className="input text-sm" placeholder="https://api.guusto.com" />
        </div>
        <div>
          <label className="label" htmlFor="method">Method</label>
          <select id="method" name="method" defaultValue="POST" className="input text-sm">
            <option>POST</option>
            <option>GET</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="path">Path</label>
          <input id="path" name="path" defaultValue="/api/v1/orders" className="input text-sm" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="body">Request body (JSON)</label>
        <textarea
          id="body"
          name="body"
          defaultValue={candidate}
          rows={16}
          spellCheck={false}
          className="input font-mono text-xs"
          style={{ whiteSpace: 'pre' }}
        />
        <p className="mt-1 text-xs text-gray-400">Edit freely — paste the exact body Guusto documents. Leave empty for a GET.</p>
      </div>

      <div className="flex items-center gap-3">
        <SendBtn disabled={disabled} />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>

      {state.message && (
        <div>
          <div className="label mb-1">Response</div>
          <pre className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">{state.message}</pre>
        </div>
      )}
    </form>
  );
}
