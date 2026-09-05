/**
 * Lightweight, theme-aware SVG mockups for the dealer tutorial. Line work uses
 * `currentColor` (a dark-mode-remapped gray on the wrapper), so everything reads
 * on both light and dark backgrounds; brand/status accents are fixed vivid
 * colours that work on either. These are illustrative — swap in real screenshots
 * anytime by giving a step an `img` instead of an `illo`.
 */

const BRAND = '#3b82f6';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 250" role="img" className="mx-auto h-auto w-full max-w-md text-gray-400">
      <rect x="0.75" y="0.75" width="398.5" height="248.5" rx="16" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M0 16 A16 16 0 0 1 16 0 H384 A16 16 0 0 1 400 16 V34 H0 Z" fill="currentColor" fillOpacity="0.06" />
      <circle cx="20" cy="17" r="4" fill={RED} fillOpacity="0.75" />
      <circle cx="34" cy="17" r="4" fill={AMBER} fillOpacity="0.75" />
      <circle cx="48" cy="17" r="4" fill={GREEN} fillOpacity="0.75" />
      {children}
    </svg>
  );
}

// A rounded line box (input / card).
function Box(props: React.SVGProps<SVGRectElement>) {
  return <rect rx="7" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.3" {...props} />;
}
// A text placeholder line.
function Line({ x, y, w, o = 0.35 }: { x: number | string; y: number | string; w: number | string; o?: number }) {
  return <rect x={x} y={y} width={w} height="6" rx="3" fill="currentColor" fillOpacity={o} />;
}

function Login() {
  return (
    <Frame>
      <circle cx="200" cy="78" r="20" fill={BRAND} fillOpacity="0.18" stroke={BRAND} strokeOpacity="0.5" />
      <path d="M200 70 v10 M200 84 h.01" stroke={BRAND} strokeWidth="3" strokeLinecap="round" />
      <Box x="110" y="118" width="180" height="26" />
      <Line x="122" y="128" w={70} />
      <Box x="110" y="152" width="180" height="26" />
      <Line x="122" y="162" w={90} />
      <rect x="110" y="188" width="180" height="28" rx="7" fill={BRAND} fillOpacity="0.85" />
      <rect x="176" y="199" width="48" height="6" rx="3" fill="#fff" fillOpacity="0.9" />
    </Frame>
  );
}

function Dashboard() {
  return (
    <Frame>
      <Box x="20" y="48" width="250" height="24" />
      <Line x="30" y="57" w={110} />
      <rect x="280" y="48" width="100" height="24" rx="7" fill={BRAND} fillOpacity="0.85" />
      <rect x="298" y="58" width="64" height="6" rx="3" fill="#fff" fillOpacity="0.9" />
      {[92, 126, 160, 194].map((y, i) => (
        <g key={y}>
          <Box x="20" y={y} width="360" height="28" />
          <Line x="34" y={y + 11} w={90} o={0.5} />
          <rect x="300" y={y + 8} width="66" height="14" rx="7" fill={i === 0 ? AMBER : i === 1 ? GREEN : '#94a3b8'} fillOpacity="0.35" />
        </g>
      ))}
      <Line x="20" y={228} w={70} o={0.25} />
    </Frame>
  );
}

function Search() {
  return (
    <Frame>
      <circle cx="46" cy="62" r="12" fill={BRAND} fillOpacity="0.18" />
      <Line x="66" y="52" w={150} o={0.55} />
      <Line x="66" y="66" w={100} o={0.3} />
      <Box x="20" y="90" width="300" height="30" />
      <Line x="34" y="102" w={120} />
      <rect x="330" y="90" width="50" height="30" rx="7" fill={BRAND} fillOpacity="0.85" />
      {[132, 168].map((y) => (
        <g key={y}>
          <Box x="20" y={y} width="360" height="30" />
          <Line x="34" y={y + 8} w={110} o={0.5} />
          <Line x="34" y={y + 20} w={150} o={0.28} />
        </g>
      ))}
    </Frame>
  );
}

function NewDeal() {
  return (
    <Frame>
      {[[20, 'Express'], [140, 'Priority'], [260, 'Standard']].map(([x], i) => (
        <g key={i}>
          <rect x={x as number} y="48" width="120" height="40" rx="8" fill={i === 0 ? BRAND : 'currentColor'} fillOpacity={i === 0 ? 0.85 : 0.05} stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.3} />
          <rect x={(x as number) + 20} y="64" width="80" height="6" rx="3" fill={i === 0 ? '#fff' : 'currentColor'} fillOpacity={i === 0 ? 0.9 : 0.4} />
        </g>
      ))}
      <Box x="20" y="104" width="175" height="26" />
      <Line x="30" y="114" w={80} />
      <Box x="205" y="104" width="175" height="26" />
      <Line x="215" y="114" w={100} />
      <Box x="20" y="138" width="360" height="26" />
      <Line x="30" y="148" w={130} />
      <rect x="20" y="176" width="16" height="16" rx="4" fill={GREEN} fillOpacity="0.7" />
      <Line x="44" y="182" w={150} o={0.4} />
      <rect x="240" y="172" width="140" height="26" rx="7" fill={BRAND} fillOpacity="0.85" />
      <rect x="288" y="182" width="44" height="6" rx="3" fill="#fff" fillOpacity="0.9" />
    </Frame>
  );
}

function Calculator() {
  return (
    <Frame>
      <Line x="20" y="48" w={120} o={0.5} />
      <Box x="20" y="60" width="360" height="34" />
      <text x="34" y="82" fontSize="18" fontWeight="700" fill={BRAND}>$</text>
      <rect x="50" y="72" width="90" height="10" rx="5" fill="currentColor" fillOpacity="0.55" />
      <Line x="20" y="106" w={70} o={0.5} />
      <Box x="20" y="118" width="360" height="30" />
      <Line x="34" y="130" w={40} />
      <rect x="0" y="164" width="400" height="86" rx="0" fill={GREEN} fillOpacity="0.14" />
      <rect x="20" y="178" width="130" height="7" rx="3.5" fill={GREEN} fillOpacity="0.7" />
      <text x="20" y="222" fontSize="26" fontWeight="800" fill={GREEN}>$10,412</text>
      <rect x="300" y="176" width="80" height="24" rx="7" fill={GREEN} fillOpacity="0.25" stroke={GREEN} strokeOpacity="0.5" />
      <rect x="318" y="185" width="44" height="6" rx="3" fill={GREEN} fillOpacity="0.9" />
    </Frame>
  );
}

function Deal() {
  return (
    <Frame>
      <rect x="20" y="46" width="70" height="20" rx="6" fill={BRAND} fillOpacity="0.8" />
      <Line x="20" y="80" w={150} o={0.6} />
      <Box x="20" y="98" width="230" height="60" />
      <Line x="32" y="110" w={90} o={0.4} />
      <Line x="32" y="126" w={140} o={0.3} />
      <Line x="32" y="142" w={110} o={0.3} />
      <Box x="262" y="98" width="118" height="60" />
      <path d="M274 128 h94" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
      <Line x="274" y="112" w={60} o={0.4} />
      <Line x="274" y="140" w={80} o={0.3} />
      <Box x="20" y="170" width="360" height="30" />
      <circle cx="40" cy="185" r="8" fill={BRAND} fillOpacity="0.25" />
      <Line x="58" y="182" w={180} o={0.35} />
    </Frame>
  );
}

function StatusBar() {
  const stages = ['S', 'A', '3', '4', '5', '6', '7'];
  return (
    <Frame>
      <Line x="130" y="60" w={140} o={0.5} />
      {stages.map((s, i) => {
        const x = 34 + i * 55;
        const done = i < 2;
        return (
          <g key={i}>
            {i > 0 && <line x1={x - 55 + 14} y1="125" x2={x - 14} y2="125" stroke={done ? GREEN : 'currentColor'} strokeOpacity={done ? 0.7 : 0.3} strokeWidth="3" />}
            <circle cx={x} cy="125" r="14" fill={done ? GREEN : 'currentColor'} fillOpacity={done ? 0.85 : 0.06} stroke={done ? GREEN : 'currentColor'} strokeOpacity={done ? 0 : 0.4} />
            {done ? (
              <path d={`M${x - 5} 125 l3.5 4 l6.5 -8`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <text x={x} y="130" fontSize="11" textAnchor="middle" fill="currentColor" fillOpacity="0.55">{s}</text>
            )}
            <rect x={x - 18} y="150" width="36" height="5" rx="2.5" fill="currentColor" fillOpacity="0.25" />
          </g>
        );
      })}
    </Frame>
  );
}

function Upload() {
  return (
    <Frame>
      <rect x="30" y="52" width="340" height="130" rx="12" fill="currentColor" fillOpacity="0.03" stroke="currentColor" strokeOpacity="0.4" strokeDasharray="6 5" />
      <path d="M200 96 v34 M186 110 l14 -14 l14 14" stroke={BRAND} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="160" y="140" width="80" height="24" rx="12" fill={BRAND} fillOpacity="0.85" />
      <rect x="182" y="149" width="36" height="6" rx="3" fill="#fff" fillOpacity="0.9" />
      {[[GREEN, 200], [AMBER, 240], [RED, 280]].map(([c, x], i) => (
        <g key={i}>
          <circle cx={x as number} cy="208" r="9" fill={c as string} fillOpacity="0.2" stroke={c as string} strokeOpacity="0.6" />
          <Line x={(x as number) + 16} y="205" w={i === 2 ? 70 : 60} o={0.35} />
        </g>
      ))}
      <rect x="20" y="200" width="150" height="16" rx="4" fill="none" />
      <Line x="30" y="205" w={100} o={0.4} />
    </Frame>
  );
}

function Viewer() {
  return (
    <Frame>
      <path d="M20 52 l8 -6 M20 52 l8 6 M20 52 h20" stroke={BRAND} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Line x="48" y="49" w={90} o={0.5} />
      <rect x="300" y="44" width="80" height="18" rx="6" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.3" />
      <Line x="316" y="50" w={48} o={0.4} />
      {[74, 150].map((y) => (
        <g key={y}>
          <rect x="70" y={y} width="260" height="68" rx="4" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.25" />
          <Line x="84" y={y + 12} w={180} o={0.3} />
          <Line x="84" y={y + 28} w={220} o={0.22} />
          <Line x="84" y={y + 44} w={150} o={0.22} />
        </g>
      ))}
    </Frame>
  );
}

function Mail() {
  return (
    <Frame>
      <rect x="20" y="48" width="20" height="20" rx="5" fill={BRAND} fillOpacity="0.8" />
      <Line x="50" y="56" w={70} o={0.5} />
      <circle cx="130" cy="52" r="4" fill={RED} />
      {[80, 118, 156].map((y, i) => (
        <g key={y}>
          <Box x="20" y={y} width="360" height="30" />
          {i === 0 && <circle cx="34" cy={y + 15} r="4" fill={BRAND} />}
          <Line x="48" y={y + 8} w={120} o={0.5} />
          <Line x="48" y={y + 20} w={200} o={0.25} />
          <rect x="330" y={y + 8} width="16" height="16" rx="3" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeOpacity="0.3" />
        </g>
      ))}
      <Line x="20" y="200" w={90} o={0.25} />
    </Frame>
  );
}

function Marketplace() {
  return (
    <Frame>
      {[20, 145, 270].map((x, i) => (
        <g key={x}>
          <Box x={x} y="52" width="110" height="140" />
          <rect x={x + 14} y="66" width="82" height="60" rx="6" fill={BRAND} fillOpacity={0.1 + i * 0.03} />
          <Line x={x + 14} y="136" w={70} o={0.4} />
          <Line x={x + 14} y="150" w={50} o={0.25} />
          <rect x={x + 14} y="164" width="82" height="18" rx="6" fill={BRAND} fillOpacity="0.8" />
        </g>
      ))}
    </Frame>
  );
}

function Resources() {
  return (
    <Frame>
      {['Resources', 'HD Promos', 'HD Card'].map((t, i) => (
        <rect key={i} x={20 + i * 90} y="46" width="80" height="22" rx="7" fill={i === 0 ? BRAND : 'currentColor'} fillOpacity={i === 0 ? 0.85 : 0.06} />
      ))}
      {[[20, 84], [205, 84], [20, 165], [205, 165]].map(([x, y], i) => (
        <g key={i}>
          <Box x={x} y={y} width="175" height="66" />
          <rect x={x + 12} y={y + 12} width="42" height="42" rx="5" fill={RED} fillOpacity="0.14" stroke={RED} strokeOpacity="0.3" />
          <text x={x + 33} y={y + 38} fontSize="9" textAnchor="middle" fill={RED} fillOpacity="0.8">PDF</text>
          <Line x={x + 66} y={y + 18} w={90} o={0.4} />
          <Line x={x + 66} y={y + 34} w={70} o={0.25} />
          <rect x={x + 66} y={y + 44} width="50" height="14" rx="5" fill={BRAND} fillOpacity="0.7" />
        </g>
      ))}
    </Frame>
  );
}

function Account() {
  return (
    <Frame>
      <circle cx="60" cy="82" r="22" fill={BRAND} fillOpacity="0.18" stroke={BRAND} strokeOpacity="0.4" />
      <circle cx="60" cy="74" r="7" fill={BRAND} fillOpacity="0.6" />
      <path d="M46 96 a14 12 0 0 1 28 0" fill={BRAND} fillOpacity="0.6" />
      <Line x="98" y="70" w={120} o={0.5} />
      <Line x="98" y="88" w={90} o={0.28} />
      {[[GREEN, 'Notifications'], [BRAND, 'Security'], ['#94a3b8', 'Replay tour']].map(([c], i) => {
        const y = 128 + i * 34;
        return (
          <g key={i}>
            <Box x="20" y={y} width="360" height="26" />
            <Line x="34" y={y + 10} w={120} o={0.4} />
            <rect x="330" y={y + 5} width="34" height="16" rx="8" fill={c as string} fillOpacity="0.3" />
            <circle cx={i === 2 ? 338 : 356} cy={y + 13} r="6" fill={c as string} fillOpacity="0.9" />
          </g>
        );
      })}
    </Frame>
  );
}

// The top navigation bar, showing a few everyday tabs plus a dropdown "group"
// opened to reveal its sub-items — the concept behind the consolidated menus.
function Nav() {
  const tabs: [number, number, string, boolean][] = [
    [40, 58, 'Applications', false],
    [104, 62, 'New customer', false],
    [172, 34, 'Mail', false],
    [212, 44, 'Tools ▾', false],
    [262, 96, 'Sales & rewards ▾', true],
  ];
  return (
    <Frame>
      <rect x="0.75" y="34" width="398.5" height="30" fill="currentColor" fillOpacity="0.05" />
      <circle cx="22" cy="49" r="7" fill={BRAND} fillOpacity="0.8" />
      {tabs.map(([x, w, label, active]) => (
        <g key={label}>
          <rect x={x} y="41" width={w} height="16" rx="6" fill={active ? BRAND : 'currentColor'} fillOpacity={active ? 0.85 : 0.06} />
          <text x={x + w / 2} y="52" fontSize="7.5" textAnchor="middle" fill={active ? '#fff' : 'currentColor'} fillOpacity={active ? 0.95 : 0.6}>{label}</text>
        </g>
      ))}
      {/* Dropdown opened under the active group. */}
      <rect x="262" y="70" width="120" height="98" rx="9" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.28" />
      {['Marketplace', 'Leads', 'Gift cards'].map((t, i) => {
        const y = 82 + i * 28;
        return (
          <g key={t}>
            {i === 2 && <rect x="270" y={y - 8} width="104" height="24" rx="6" fill={BRAND} fillOpacity="0.1" />}
            <circle cx="282" cy={y + 4} r="3.5" fill={BRAND} fillOpacity={0.35 + i * 0.2} />
            <text x="296" y={y + 7} fontSize="8.5" fill="currentColor" fillOpacity="0.7">{t}</text>
          </g>
        );
      })}
    </Frame>
  );
}

// The water-test gift-card request form, with a dated "sent" receipt below.
function GiftCards() {
  return (
    <Frame>
      <Line x="20" y="52" w={110} o={0.55} />
      <Box x="20" y="64" width="360" height="26" />
      <Line x="32" y="74" w={90} o={0.3} />
      <Box x="20" y="96" width="360" height="26" />
      <Line x="32" y="106" w={140} o={0.3} />
      <Box x="20" y="128" width="120" height="26" />
      <text x="32" y="146" fontSize="13" fontWeight="700" fill={BRAND}>$</text>
      <rect x="48" y="137" width="30" height="8" rx="4" fill="currentColor" fillOpacity="0.55" />
      <rect x="20" y="162" width="140" height="26" rx="7" fill={BRAND} fillOpacity="0.85" />
      <text x="90" y="179" fontSize="8.5" textAnchor="middle" fill="#fff" fillOpacity="0.95">Request gift card</text>
      {/* Sent receipt */}
      <rect x="20" y="204" width="360" height="34" rx="8" fill={GREEN} fillOpacity="0.12" stroke={GREEN} strokeOpacity="0.3" />
      <circle cx="42" cy="221" r="9" fill={GREEN} fillOpacity="0.22" stroke={GREEN} strokeOpacity="0.6" />
      <path d="M37 221 l3.5 4 l7 -8.5" stroke={GREEN} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="60" y="219" fontSize="8.5" fontWeight="700" fill={GREEN} fillOpacity="0.9">Sent</text>
      <Line x="60" y="226" w={150} o={0.3} />
    </Frame>
  );
}

function Applications() {
  return (
    <Frame>
      {['Tracker', 'Pipeline', 'List', 'Progress'].map((t, i) => (
        <g key={t}>
          <rect x={20 + i * 80} y="46" width="74" height="22" rx="7" fill={i === 0 ? BRAND : 'currentColor'} fillOpacity={i === 0 ? 0.85 : 0.06} stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.25} />
          <text x={20 + i * 80 + 37} y="61" fontSize="8" fontWeight="700" textAnchor="middle" fill={i === 0 ? '#fff' : 'currentColor'} fillOpacity={i === 0 ? 0.95 : 0.5}>{t}</text>
        </g>
      ))}
      <rect x="20" y="84" width="360" height="20" rx="6" fill={RED} fillOpacity="0.1" />
      <text x="30" y="98" fontSize="8" fontWeight="700" fill={RED} fillOpacity="0.85">Needs your action</text>
      {[112, 142, 172, 202].map((y, i) => (
        <g key={y}>
          <Box x="20" y={y} width="360" height="26" />
          <Line x="34" y={y + 11} w={90} o={0.5} />
          <rect x="300" y={y + 8} width="66" height="12" rx="6" fill={i === 0 ? AMBER : GREEN} fillOpacity="0.35" />
        </g>
      ))}
    </Frame>
  );
}

function Chat() {
  return (
    <Frame>
      <rect x="120" y="40" width="220" height="182" rx="10" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M120 50 A10 10 0 0 1 130 40 H330 A10 10 0 0 1 340 50 V66 H120 Z" fill={BRAND} fillOpacity="0.85" />
      <text x="134" y="58" fontSize="8.5" fontWeight="700" fill="#fff">GWA team chat</text>
      <rect x="134" y="80" width="120" height="24" rx="8" fill="currentColor" fillOpacity="0.08" />
      <Line x="144" y="90" w={90} o={0.4} />
      <rect x="206" y="116" width="120" height="24" rx="8" fill={BRAND} fillOpacity="0.7" />
      <rect x="216" y="126" width="90" height="5" rx="2.5" fill="#fff" fillOpacity="0.85" />
      <rect x="134" y="190" width="150" height="20" rx="10" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" />
      <rect x="292" y="190" width="34" height="20" rx="8" fill={BRAND} fillOpacity="0.85" />
      <circle cx="356" cy="212" r="15" fill={BRAND} fillOpacity="0.9" />
      <path d="M349 208 h14 M349 213 h9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}

function Leads() {
  const tiles: [string, string, string][] = [['60', 'RECEIVED', BRAND], ['47', 'FORWARDED', GREEN], ['13', 'NO-GOOD', RED]];
  return (
    <Frame>
      {tiles.map(([n, label, color], i) => (
        <g key={label}>
          <Box x={20 + i * 123} y="46" width="113" height="40" />
          <text x={32 + i * 123} y="66" fontSize="13" fontWeight="800" fill={color} fillOpacity="0.9">{n}</text>
          <text x={32 + i * 123} y="80" fontSize="6.5" fontWeight="700" fill="currentColor" fillOpacity="0.45">{label}</text>
        </g>
      ))}
      <Box x="20" y="98" width="360" height="24" />
      <Line x="34" y="108" w={120} />
      {[132, 164, 196].map((y, i) => (
        <g key={y}>
          <rect x="20" y={y} width="4" height="26" rx="2" fill={i === 1 ? RED : GREEN} fillOpacity="0.6" />
          <Box x="20" y={y} width="360" height="26" />
          <Line x="36" y={y + 9} w={100} o={0.5} />
          <Line x="36" y={y + 18} w={70} o={0.28} />
          <rect x="318" y={y + 8} width="48" height="12" rx="6" fill={i === 1 ? RED : GREEN} fillOpacity="0.3" />
        </g>
      ))}
    </Frame>
  );
}

function Reports() {
  return (
    <Frame>
      {['Monthly', 'Pricing', 'Custom', 'Forecast'].map((t, i) => (
        <g key={t}>
          <rect x={20 + i * 82} y="46" width="76" height="20" rx="10" fill={i === 0 ? BRAND : 'currentColor'} fillOpacity={i === 0 ? 0.85 : 0.06} />
          <text x={20 + i * 82 + 38} y="60" fontSize="7.5" fontWeight="700" textAnchor="middle" fill={i === 0 ? '#fff' : 'currentColor'} fillOpacity={i === 0 ? 0.95 : 0.5}>{t}</text>
        </g>
      ))}
      {[60, 110, 150, 90, 170, 130].map((h, i) => (
        <rect key={i} x={40 + i * 56} y={206 - h} width="34" height={h} rx="4" fill={BRAND} fillOpacity={0.35 + i * 0.08} />
      ))}
      <line x1="20" y1="208" x2="380" y2="208" stroke="currentColor" strokeOpacity="0.2" />
    </Frame>
  );
}

const ILLOS: Record<string, () => JSX.Element> = {
  login: Login,
  applications: Applications,
  chat: Chat,
  leads: Leads,
  reports: Reports,
  nav: Nav,
  dashboard: Dashboard,
  search: Search,
  newdeal: NewDeal,
  calculator: Calculator,
  deal: Deal,
  statusbar: StatusBar,
  upload: Upload,
  viewer: Viewer,
  mail: Mail,
  marketplace: Marketplace,
  giftcards: GiftCards,
  resources: Resources,
  account: Account,
};

export function TutorialIllo({ name }: { name: string }) {
  const C = ILLOS[name];
  return C ? <C /> : null;
}
