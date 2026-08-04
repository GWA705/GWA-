'use client';

import { useState } from 'react';
import { completeWelcomeTourAction } from '@/app/(account)/actions';

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Welcome to the GWA Dealer Portal',
    body: 'This quick tour shows you where everything is. It takes under a minute — you can replay it any time from “My account.”',
  },
  {
    emoji: '➕',
    title: 'Process a new customer',
    body: '“New customer” is where you start a deal. You’ll pick one of three ways to submit — Express (Financeit number), Priority (type it in), or Standard (photo upload). The form guides you the rest of the way.',
  },
  {
    emoji: '📋',
    title: 'Track your deals',
    body: '“Applications” lists every deal you’ve submitted and its status. Click a deal to see its progress, upload funding paperwork, and view documents.',
  },
  {
    emoji: '📎',
    title: 'Documents & funding paperwork',
    body: 'Inside a deal you can upload the funding package (contract, void cheque/PAP, photos, ID, etc.). Cards turn green once our team confirms each item. Paperwork we send back to you appears there too.',
  },
  {
    emoji: '💬',
    title: 'Chat with the reviewer',
    body: 'Each deal has a notes area to message our reviewers directly — ask a question or add context, and you’ll get an email when they reply.',
  },
  {
    emoji: '✉️',
    title: 'Mail from GWA',
    body: 'The Mail tab is where we send you messages and files — bulletins, promos, and paperwork. A dot means something new; open a message to read it and grab any attachments. Some ask you to tap “I have read this.”',
  },
  {
    emoji: '🛍️',
    title: 'Marketplace',
    body: 'Order branded gear (apparel, signage, sample kits) and download ready-to-use files like print-ready signage — all organized by category. There are no prices; just choose what you need and submit.',
  },
  {
    emoji: '📚',
    title: 'Resources & promotions',
    body: 'The Resources, HD Promotions, and HD Credit Card tabs hold guides and current promos. Check back — we keep them up to date.',
  },
  {
    emoji: '📱',
    title: 'Install it & get notified',
    body: 'From “My account” you can add the portal to your phone’s home screen (it opens like an app) and turn on notifications so you get a pop-up when a deal needs you. You can also update your details, sign-in security, and replay this tour there. You’re ready to go!',
  },
];

export function WelcomeTour({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);

  if (!open) return null;

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const isFirst = i === 0;

  const finish = () => {
    setOpen(false);
    // Best-effort: record that the tour was seen so it doesn't auto-open again.
    void completeWelcomeTourAction();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <span className="text-4xl" aria-hidden>{step.emoji}</span>
          <button
            type="button"
            onClick={finish}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Skip tour
          </button>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          {isFirst && userName ? `Welcome, ${userName.split(' ')[0]}!` : step.title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">{step.body}</p>

        {/* Progress dots */}
        <div className="my-5 flex justify-center gap-1.5">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-brand-600' : 'w-1.5 bg-gray-300'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            className={`btn-secondary text-sm ${isFirst ? 'invisible' : ''}`}
          >
            Back
          </button>
          <span className="text-xs text-gray-400">{i + 1} of {STEPS.length}</span>
          {isLast ? (
            <button type="button" onClick={finish} className="btn-primary text-sm">
              Got it
            </button>
          ) : (
            <button type="button" onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))} className="btn-primary text-sm">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
