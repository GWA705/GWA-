'use client';

import { useState } from 'react';
import { completeWelcomeTourAction } from '@/app/(account)/actions';
import { useI18n } from '@/i18n/client';

interface Copy {
  title: string;
  body: string;
}
interface Step {
  emoji: string;
  en: Copy;
  fr: Copy;
}

// Bilingual tour steps. The dealer sees these in their portal language.
const STEPS: Step[] = [
  {
    emoji: '👋',
    en: {
      title: 'Welcome to your dealer portal',
      body: 'This quick tour shows you where everything is. It takes under a minute — you can replay it any time from “My account.”',
    },
    fr: {
      title: 'Bienvenue dans votre portail des marchands',
      body: 'Cette visite rapide vous montre où se trouve chaque chose. Moins d’une minute — vous pouvez la revoir en tout temps depuis « Mon compte ».',
    },
  },
  {
    emoji: '🧭',
    en: {
      title: 'Finding your way around',
      body: 'Your everyday tabs — Applications, New customer and Mail — stay at the top. The rest is grouped into menus: Tools (Find customer, HD Payout, Reports), Sales & rewards (Marketplace, Leads, Gift cards), Resources, and My office. On a phone, tap ☰ to see them stacked.',
    },
    fr: {
      title: 'Vous repérer',
      body: 'Vos onglets de tous les jours — Demandes, Nouveau client et Courrier — restent en haut. Le reste est regroupé en menus : Outils (Trouver un client, Calcul HD, Rapports), Ventes et récompenses (Marketplace, Prospects, Cartes-cadeaux), Ressources et Mon bureau. Sur un téléphone, touchez ☰ pour les voir empilés.',
    },
  },
  {
    emoji: '➕',
    en: {
      title: 'Process a new customer',
      body: '“New customer” is where you start a deal. You’ll pick one of three ways to submit — Express (Financeit number), Priority (type it in), or Standard (photo upload). The form guides you the rest of the way.',
    },
    fr: {
      title: 'Traiter un nouveau client',
      body: '« Nouveau client » est l’endroit où commencer une demande. Vous choisirez l’une des trois façons de soumettre — Express (numéro Financeit), Prioritaire (saisir les détails) ou Standard (téléverser des photos). Le formulaire vous guide pour le reste.',
    },
  },
  {
    emoji: '🪪',
    en: {
      title: 'Auto-fill from a scan',
      body: 'Save the typing: scan the customer’s driver’s licence (point the camera at the barcode on the back) or scan a filled credit application, and the applicant fields fill in automatically. Always review before submitting.',
    },
    fr: {
      title: 'Remplissage automatique par numérisation',
      body: 'Gagnez du temps : numérisez le permis de conduire du client (dirigez la caméra vers le code-barres au dos) ou numérisez une demande de crédit remplie, et les champs du demandeur se remplissent automatiquement. Vérifiez toujours avant de soumettre.',
    },
  },
  {
    emoji: '📋',
    en: {
      title: 'Track your deals',
      body: '“Applications” lists every deal you’ve submitted and its status. Click a deal to see its progress, upload funding paperwork, and view documents.',
    },
    fr: {
      title: 'Suivre vos demandes',
      body: '« Demandes » liste chaque dossier soumis et son statut. Cliquez sur un dossier pour voir sa progression, téléverser les documents de financement et consulter les pièces.',
    },
  },
  {
    emoji: '📎',
    en: {
      title: 'Documents & funding paperwork',
      body: 'Inside a deal you can upload the funding package (contract, void cheque/PAP, photos, ID, etc.). Cards turn green once our team confirms each item. Paperwork we send back to you appears there too.',
    },
    fr: {
      title: 'Documents et pièces de financement',
      body: 'Dans un dossier, vous pouvez téléverser le dossier de financement (contrat, spécimen de chèque/DPA, photos, pièce d’identité, etc.). Les cartes deviennent vertes une fois chaque élément confirmé par notre équipe. Les documents que nous vous renvoyons y apparaissent aussi.',
    },
  },
  {
    emoji: '💬',
    en: {
      title: 'Chat with the reviewer',
      body: 'Each deal has a notes area to message our reviewers directly — ask a question or add context, and you’ll get an email when they reply.',
    },
    fr: {
      title: 'Clavarder avec le réviseur',
      body: 'Chaque dossier comporte une zone de notes pour écrire directement à nos réviseurs — posez une question ou ajoutez du contexte, et vous recevrez un courriel dès qu’ils répondent.',
    },
  },
  {
    emoji: '✉️',
    en: {
      title: 'Mail from the office',
      body: 'The Mail tab is where we send you messages and files — bulletins, promos, and paperwork. A dot means something new; open a message to read it and grab any attachments. Some ask you to tap “I have read this.”',
    },
    fr: {
      title: 'Courrier du bureau',
      body: 'L’onglet Courrier est là où nous vous envoyons des messages et des fichiers — bulletins, promotions et documents. Un point signale du nouveau; ouvrez un message pour le lire et récupérer les pièces jointes. Certains vous demandent de toucher « J’ai lu ceci ».',
    },
  },
  {
    emoji: '🛍️',
    en: {
      title: 'Marketplace',
      body: 'Under Sales & rewards, order branded gear (apparel, signage, sample kits) and download ready-to-use files like print-ready signage — all organized by category. There are no prices; just choose what you need and submit.',
    },
    fr: {
      title: 'Marketplace',
      body: 'Sous Ventes et récompenses, commandez du matériel de marque (vêtements, affichage, trousses d’échantillons) et téléchargez des fichiers prêts à l’emploi comme de l’affichage prêt à imprimer — le tout classé par catégorie. Aucun prix; choisissez simplement ce qu’il vous faut et soumettez.',
    },
  },
  {
    emoji: '🎁',
    en: {
      title: 'Water-test gift cards',
      body: 'Did a water test? Under Sales & rewards → Gift cards, enter the customer’s name, email and amount and tap Request. We email the Home Depot card through Guusto and mark it sent — you’ll see a dated “Sent” receipt, so there’s no more posting names in a group chat.',
    },
    fr: {
      title: 'Cartes-cadeaux pour test d’eau',
      body: 'Un test d’eau effectué ? Sous Ventes et récompenses → Cartes-cadeaux, saisissez le nom, le courriel et le montant du client, puis touchez Demander. Nous envoyons la carte Home Depot par Guusto et la marquons envoyée — vous verrez un reçu « Envoyée » daté, fini d’afficher des noms dans un groupe de clavardage.',
    },
  },
  {
    emoji: '📚',
    en: {
      title: 'Resources & promotions',
      body: 'The Resources menu holds product guides, HD Promotions, and HD Credit Card help. Check back — we keep them up to date.',
    },
    fr: {
      title: 'Ressources et promotions',
      body: 'Le menu Ressources contient les guides de produits, les Promotions HD et l’aide sur la carte de crédit HD. Revenez y jeter un œil — nous les tenons à jour.',
    },
  },
  {
    emoji: '📱',
    en: {
      title: 'Install it & get notified',
      body: 'From “My account” you can add the portal to your phone’s home screen (it opens like an app) and turn on notifications so you get a pop-up when a deal needs you. You can also update your details, sign-in security, and replay this tour there. You’re ready to go!',
    },
    fr: {
      title: 'Installez-le et soyez avisé',
      body: 'Depuis « Mon compte », ajoutez le portail à l’écran d’accueil de votre téléphone (il s’ouvre comme une appli) et activez les notifications pour recevoir une alerte quand un dossier requiert votre attention. Vous pouvez aussi mettre à jour vos renseignements, la sécurité de connexion et revoir cette visite. Vous êtes prêt !',
    },
  },
];

const UI = {
  en: { skip: 'Skip tour', back: 'Back', next: 'Next', done: 'Got it', of: 'of', welcome: (n: string) => `Welcome, ${n}!` },
  fr: { skip: 'Passer', back: 'Précédent', next: 'Suivant', done: 'Compris', of: 'sur', welcome: (n: string) => `Bienvenue, ${n} !` },
};

export function WelcomeTour({ userName }: { userName?: string }) {
  const { locale } = useI18n();
  const lang = locale === 'fr' ? 'fr' : 'en';
  const ui = UI[lang];
  const [open, setOpen] = useState(true);
  const [i, setI] = useState(0);

  if (!open) return null;

  const step = STEPS[i];
  const copy = step[lang];
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
          <button type="button" onClick={finish} className="text-xs text-gray-400 hover:text-gray-600">
            {ui.skip}
          </button>
        </div>

        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          {isFirst && userName ? ui.welcome(userName.split(' ')[0]) : copy.title}
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">{copy.body}</p>

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
            {ui.back}
          </button>
          <span className="text-xs text-gray-400">{i + 1} {ui.of} {STEPS.length}</span>
          {isLast ? (
            <button type="button" onClick={finish} className="btn-primary text-sm">
              {ui.done}
            </button>
          ) : (
            <button type="button" onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))} className="btn-primary text-sm">
              {ui.next}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
