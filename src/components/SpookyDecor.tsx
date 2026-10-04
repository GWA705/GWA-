/**
 * Seasonal Halloween decoration for the sign-in screen. Purely decorative
 * (aria-hidden, pointer-events-none) and only rendered during the spooky window
 * (see isSpookySeason). Kept subtle so the form stays clean and readable; any
 * motion is disabled under prefers-reduced-motion.
 */
export function SpookyDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft purple night glow from the top. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(1100px 480px at 50% -12%, rgba(76,29,149,0.18), transparent 70%)' }}
      />

      {/* Crescent moon, top-right. */}
      <svg className="absolute right-6 top-10 h-12 w-12 opacity-80" viewBox="0 0 64 64" fill="none">
        <path d="M46 6a26 26 0 1 0 12 46A30 30 0 0 1 46 6z" fill="#f4c542" />
      </svg>

      {/* Cobweb, top-left corner. */}
      <svg
        className="absolute left-0 top-0 h-28 w-28 opacity-25"
        viewBox="0 0 100 100"
        stroke="#64748b"
        strokeWidth="1"
        fill="none"
      >
        <path d="M0 0 L100 0 M0 0 L0 100 M0 0 L72 72 M0 0 L100 42 M0 0 L42 100" />
        <path d="M0 22 Q20 15 26 0 M0 48 Q36 30 48 0 M0 74 Q56 48 72 0" />
      </svg>

      {/* A little flight of bats drifting near the top. */}
      <div className="spooky-bats absolute inset-x-0 top-14 flex justify-center gap-10 text-2xl">
        <span>🦇</span>
        <span>🦇</span>
        <span>🦇</span>
      </div>

      {/* Jack-o'-lanterns resting at the base. */}
      <div className="absolute bottom-5 left-5 select-none text-3xl opacity-85">🎃</div>
      <div className="absolute bottom-5 right-5 select-none text-3xl opacity-85">🎃</div>

      <style>{`
        @keyframes spookyFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        .spooky-bats > span { display: inline-block; animation: spookyFloat 4s ease-in-out infinite; }
        .spooky-bats > span:nth-child(2) { animation-delay: .8s }
        .spooky-bats > span:nth-child(3) { animation-delay: 1.6s }
        @media (prefers-reduced-motion: reduce) { .spooky-bats > span { animation: none } }
      `}</style>
    </div>
  );
}
