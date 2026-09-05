import { requireDealerAccess } from '@/lib/session';
import { SectionHero } from '@/components/SectionHero';
import { TutorialImage } from './TutorialImage';
import { TutorialIllo } from './illustrations';

export const dynamic = 'force-dynamic';

interface Step {
  title: string;
  body: string[];
  // A real screenshot (`img`) is shown when the file exists; otherwise it falls
  // back to the line mockup (`illo`). Step numbers are assigned by position.
  illo?: string;
  img?: string;
  alt?: string;
  // Optional platform how-to lists shown instead of a visual.
  howtos?: { heading: string; steps: string[] }[];
}

const STEPS: Step[] = [
  {
    title: 'Sign in',
    body: [
      'Go to portal.ghsbarrie.ca and sign in with your email and password.',
      'The first time you log in, a short welcome tour pops up automatically — you can replay it anytime from My account. For extra security you can turn on a 6-digit code at sign-in.',
    ],
    illo: 'login',
    img: '/tutorial/01-login.png',
    alt: 'The Georgian Water & Air dealer portal sign-in screen.',
  },
  {
    title: 'Finding your way around',
    body: [
      'On a computer, the dark blue sidebar on the left is your main menu. Your everyday items sit at the top — Home, Applications, New customer and Mail — and the rest is grouped under Tools, Resources and My office. Your office logo and “Dealer Portal” show at the top left.',
      'Along the very top you’ll find a search box, the mail bell, your initials, a light/dark switch, and Sign out.',
      'On a phone, tap the menu button (☰) at the top left to slide the same menu out.',
    ],
    illo: 'nav',
    img: '/tutorial/02-navigation.png',
    alt: 'The dealer portal sidebar and top bar.',
  },
  {
    title: 'Your home dashboard',
    body: [
      'Home is your at-a-glance screen. A welcome banner greets you by name, then four cards show your Total Applications, Approved, Pending and Total Value for the month.',
      'Below that, Recent Applications previews your latest deals, Quick Actions jump you straight to New Customer, Product Resources, Leads and the Marketplace, and a Need Support card opens a live chat with our team.',
      'Further down, simple charts show your deals by status, your month-by-month volume, and your program mix.',
    ],
    illo: 'dashboard',
    img: '/tutorial/03-dashboard.png',
    alt: 'The dealer home dashboard with greeting banner, KPI cards, recent applications and charts.',
  },
  {
    title: 'Applications — track every deal your way',
    body: [
      'Applications is where you watch your deals move through approval, documents and funding. Four buttons at the top let you pick the view that suits you, and the portal remembers your choice:',
      'Tracker groups deals by what needs doing — “Needs your action”, “In progress — with GWA”, “Funded & paid”, and “Closed”. Pipeline shows columns by stage (Submitted → Approved → Docs & funding → Funded/Paid). List is the classic sortable table, and Progress shows a progress bar for each deal.',
      'One search box and sort control drive every view, and deals you pin (📌) always float to the top. Tap any customer to open their deal.',
    ],
    illo: 'applications',
    img: '/tutorial/04-applications.png',
    alt: 'The Applications workspace with the Tracker / Pipeline / List / Progress view switcher.',
  },
  {
    title: 'Process a new customer',
    body: [
      'Pick how you’re entering the deal at the top: Express (already approved — a FinanceIT number, or paid by cash/cheque/credit card), Priority (type the details in), or Standard (upload documents). Express hides the fields you don’t need.',
      'Fill in the customer’s details, then the Sales details — salesperson, installer, whether SOAP is included, and the product(s) sold. These feed the sales journal and the pricing reports.',
      'For employment, choose the status first — pick Retired and the employer fields drop away. Confirm consent at the bottom and tap Submit. It lands on your Applications list and with our team for review.',
    ],
    illo: 'newdeal',
    img: '/tutorial/05-new-customer.png',
    alt: 'The new-customer form with entry-method buttons, deal, sales and consent sections.',
  },
  {
    title: 'Payout calculator',
    body: [
      'Under Tools, the HD Payout calculator shows your estimated EFT payout in seconds. Enter the approved amount (total sale with tax) and pick the province — every line updates live.',
      'Already have the deal in the portal? Type the customer name or deal # in “Find a portal deal” and it pulls the approved amount and province in. Tap Copy to grab the breakdown.',
    ],
    illo: 'calculator',
    img: '/tutorial/06-payout.png',
    alt: 'The payout calculator with an approved amount, province and an estimated EFT payout.',
  },
  {
    title: 'Open & track a deal',
    body: [
      'Tap any customer to open their deal. At the top a progress bar shows exactly where it stands; below it a “What’s needed from you” card spells out your next step in plain language.',
      'The Customer snapshot recaps the products, amounts and contact details. Anything we share back — paperwork for your customer, or a payout receipt — appears here too.',
    ],
    illo: 'deal',
    img: '/tutorial/07-deal.png',
    alt: 'A deal page showing the progress bar, what’s-needed card, snapshot and documents.',
  },
  {
    title: 'Read the progress bar',
    body: [
      'Across the top of every deal is a progress bar with the stages: Submitted → Approved → Docs uploaded → Confirmation → In for funding → Funded → Paid.',
      'The filled portion and the “Step X of 7” tell you at a glance what’s finished and what’s next.',
    ],
    illo: 'statusbar',
    img: '/tutorial/08-progress.png',
    alt: 'The deal progress bar with its seven stages.',
  },
  {
    title: 'Upload your funding documents',
    body: [
      'When a deal is approved and installed, send us the funding package. Drag your files onto the drop area — or tap “Add files.” Drop several at once (PDFs or photos), then tap Upload.',
      'The checklist shows exactly what’s needed and ticks green as each item arrives. It adapts to the deal: HD-program deals include the Home Depot documents and waiver; Georgian Water & Air-program deals don’t ask for those.',
    ],
    illo: 'upload',
    img: '/tutorial/09-upload.png',
    alt: 'The drag-and-drop upload area with a funding checklist.',
  },
  {
    title: 'Chat with the GWA team',
    body: [
      'The blue chat bubble in the bottom-right corner is a direct line to our team, on any page. It keeps a thread for each deal plus a General support thread, and shows a red badge when there’s a new reply.',
      'The Need Support card on your dashboard opens the same chat. Card numbers are automatically removed if they’re ever typed, so nothing sensitive is stored.',
    ],
    illo: 'chat',
    img: '/tutorial/10-chat.png',
    alt: 'The corner chat widget open with deal and general support threads.',
  },
  {
    title: 'Mail from the office',
    body: [
      'The Mail tab is where our office sends you messages and files — bulletins, promos and paperwork. A dot on the Mail tab (and the top-bar bell) means something new is waiting.',
      'Open a message to read it and see attachments as previews. Tap one to view it right inside the portal, or Download to save it. If a message asks you to confirm you’ve read it, tap “I have read this.”',
    ],
    illo: 'mail',
    img: '/tutorial/11-mail.png',
    alt: 'The Mail inbox with unread markers and attachment previews.',
  },
  {
    title: 'Marketplace — order gear',
    body: [
      'The Marketplace lists branded items you can order — apparel, signage and more. There are no prices and nothing to pay; it’s an order request.',
      'Browse by category card or search, pick a size/option and quantity, and add it to your cart on the right. Add a note if needed, then Submit order — our team takes it from there. The Need help card opens chat if you have a question.',
    ],
    illo: 'marketplace',
    img: '/tutorial/12-marketplace.png',
    alt: 'The Marketplace with category cards, product grid and a cart panel.',
  },
  {
    title: 'Water-test gift cards',
    body: [
      'Completed a water test? Send the customer their Home Depot gift card from Gift cards. Enter their name, email and the amount ($25 by default), then tap Request gift card.',
      'Our team emails the card through Guusto and marks it sent — a dated “Sent” receipt appears next to the request. Until then it shows Pending, and you can cancel while it’s still pending. Everything you’ve requested stays listed with its status.',
    ],
    illo: 'giftcards',
    img: '/tutorial/13-gift-cards.png',
    alt: 'The gift-card request form with a dated sent receipt below.',
  },
  {
    title: 'Leads',
    body: [
      'The Leads tab shows the Home Depot leads sent to your office, with running totals (Received, Forwarded, No-good). Search by name, phone, address, booking or store.',
      'Switch between a List, a Grouped view, and a Map to see where your leads are. Open any lead to review the details and outcome.',
    ],
    illo: 'leads',
    img: '/tutorial/14-leads.png',
    alt: 'The Leads list with stat tiles, search and list/grouped/map views.',
  },
  {
    title: 'Reports',
    body: [
      'Under Tools, Reports shows your office’s performance — Monthly performance and Weekly store detail — drawn from the sales journal.',
      'If you’re the office owner and we’ve enabled reports for your office, you’ll also see Product & package pricing: the average sale price for each product on its own, and for each package (products sold together). It’s a great way to watch your pricing. Regular office logins don’t see this tab.',
    ],
    illo: 'reports',
    img: '/tutorial/15-reports.png',
    alt: 'The dealer reports area with monthly, weekly and (owner) product-pricing tabs.',
  },
  {
    title: 'Resources, HD Promotions & HD Credit Card',
    body: [
      'The Resources menu has product guides and manuals (Product library), current HD Promotions, and step-by-step help for the Home Depot credit card.',
      'Each item shows a preview — tap View to open it inside the portal, or Download to save and share it.',
    ],
    illo: 'resources',
    img: '/tutorial/16-resources.png',
    alt: 'The Resources area with preview cards and PDF thumbnails.',
  },
  {
    title: 'Your account',
    body: [
      'Under My office → My account you can update your details, choose which email notifications you get, and turn on extra sign-in security (a 6-digit code). You can also replay the welcome tour here anytime.',
    ],
    illo: 'account',
    img: '/tutorial/17-account.png',
    alt: 'The My account page with profile, notifications and security options.',
  },
  {
    title: 'Get notifications & pop-ups on your phone',
    body: [
      'The portal can pop up a notification on your phone or computer the moment there’s activity on a deal — even when the portal isn’t open. These come on top of the emails you already get.',
      'Turn it on under My account → “Desktop & phone notifications” → Enable. Do it once on each device, then use “Send a test” to confirm it’s working.',
    ],
    howtos: [
      {
        heading: '📱 iPhone / iPad (iOS 16.4 or newer)',
        steps: [
          'Open portal.ghsbarrie.ca in Safari.',
          'Tap the Share button (the square with an up-arrow).',
          'Tap “Add to Home Screen,” then Add.',
          'Open the portal from the new Home Screen icon (not Safari).',
          'Go to My account → Desktop & phone notifications → Enable, and allow when asked.',
        ],
      },
      {
        heading: '🤖 Android phone',
        steps: [
          'Open portal.ghsbarrie.ca in Chrome.',
          'Go to My account → Desktop & phone notifications → Enable.',
          'Tap Allow when Chrome asks. That’s it — no install needed.',
        ],
      },
      {
        heading: '💻 Computer (Chrome, Edge or Firefox)',
        steps: [
          'Go to My account → Desktop & phone notifications → Enable.',
          'Click Allow when the browser asks. Pop-ups appear in the corner of your screen.',
        ],
      },
    ],
  },
];

export default async function TutorialPage() {
  await requireDealerAccess();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHero
        eyebrow="Help"
        title="How to use the portal"
        subtitle="A full, step-by-step walkthrough — from signing in to tracking a deal all the way to funded. Come back anytime."
      />

      <ol className="space-y-8">
        {STEPS.map((s, idx) => (
          <li key={idx} className="card overflow-hidden">
            <div className="flex items-start gap-3 p-6 pb-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {idx + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{s.title}</h2>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-700">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            </div>
            {s.howtos && (
              <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                {s.howtos.map((h) => (
                  <div key={h.heading} className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">{h.heading}</h3>
                    <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-gray-700">
                      {h.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
            {s.img ? (
              <TutorialImage src={s.img} alt={s.alt} illo={s.illo} />
            ) : (
              s.illo && (
                <div className="border-t border-gray-100 bg-gray-50 p-5">
                  <TutorialIllo name={s.illo} />
                </div>
              )
            )}
          </li>
        ))}
      </ol>

      <p className="text-center text-sm text-gray-500">
        Still stuck? Tap the chat bubble in the corner and our team will help.
      </p>
    </div>
  );
}
