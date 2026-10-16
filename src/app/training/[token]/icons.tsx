// Friendly inline-SVG icons for the training flow. All use currentColor so they
// theme with the surrounding accent, and all are decorative (aria-hidden).

export function SectionIcon({ name, className = 'h-7 w-7' }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'dress-code': // boot
      return (<svg {...common}><path d="M7 3v9c0 1-.4 2-1.2 2.7L4 16c-1 1-1 3 1 3h13a2 2 0 0 0 2-2c0-2-1-3-3-4l-4-2c-1-.6-1.8-1.6-1.8-3V3z" /><path d="M7 10h4" /></svg>);
    case 'what-to-bring': // bag / kit
      return (<svg {...common}><path d="M4 8h16l-1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>);
    case 'signing-in': // QR
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7M17 21h4" /></svg>);
    case 'expectations': // speech bubbles
      return (<svg {...common}><path d="M3 11a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H9l-4 3v-3a4 4 0 0 1-2-3.5z" /><path d="M9 11h.01M12 11h.01" /></svg>);
    case 'maintaining-area': // broom
      return (<svg {...common}><path d="M19 4l-7 7" /><path d="M11 10l-5 5c-1 1-1 3-1 4h4c1 0 3 0 4-1l4-4" /><path d="M8 20l-3-3" /></svg>);
    case 'the-pitch': // gift + spark
      return (<svg {...common}><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M4 13h16M12 9v11" /><path d="M12 9c-2-3-6-2-6 0h6zm0 0c2-3 6-2 6 0h-6z" /></svg>);
    case 'questions': // chat ?
      return (<svg {...common}><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z" /><path d="M9.2 8.5a2.5 2.5 0 0 1 4.8 1c0 1.6-2 2-2 3.5M12 16h.01" /></svg>);
    case 'leads': // tag
      return (<svg {...common}><path d="M3 12l8.5-8.5a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v5.1a2 2 0 0 1-.6 1.4L12 21a2 2 0 0 1-2.8 0L3 14.8a2 2 0 0 1 0-2.8z" /><circle cx="16.5" cy="7.5" r="1.3" /></svg>);
    case 'gift-card': // gift card $
      return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><path d="M14 14.5c0 .8-.9 1-1.5 1s-1.5-.2-1.5-1 .9-1 1.5-1.2 1.5-.4 1.5-1.2-.9-1-1.5-1-1.5.2-1.5 1M12.5 12.3v3.6" /></svg>);
    case 'finding-products': // map pin
      return (<svg {...common}><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>);
    case 'quiz': // checklist
      return (<svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8l1.5 1.5L12 7M8 15l1.5 1.5L12 14M15 8.5h2M15 15.5h2" /></svg>);
    case 'signoff': // pen signing
      return (<svg {...common}><path d="M4 18c3 1 5-3 8-3s3 2 5 1" /><path d="M14 7l3 3-7 7-3 .7.7-3 6.3-6.4a1.5 1.5 0 0 1 2.1 0l-2.1 2.1z" /></svg>);
    case 'trophy': // trophy
      return (<svg {...common}><path d="M8 4h8v4a4 4 0 0 1-8 0V4z" /><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3" /><path d="M12 12v4M9 20h6M10 16h4l.5 4h-5z" /></svg>);
    case 'no-phone': // phone slash
      return (<svg {...common}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M4 4l16 16" /></svg>);
    default:
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></svg>);
  }
}

export function CheckBadge({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.2 2.2L15.5 9.5" /></svg>);
}
