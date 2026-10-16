// Lead-Generator training content + scoring — built from the "Intro to The Home
// Depot" manual (v2026-09-23). Pure data + pure functions so it unit-tests
// cleanly and can be rendered by the public (no-login) training flow and by the
// stored certification record. Bump CONTENT_VERSION whenever the material or quiz
// changes — every certification stores the version it was completed under, so you
// can always prove what a trainee agreed to on a given date.

export const CONTENT_VERSION = '2026-09-23';
export const PASS_THRESHOLD = 80; // percent needed to pass the quiz

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note'; text: string }; // emphasised callout

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  correct: number; // index into options
}

export interface Rule {
  id: string;
  text: string;
}

export const SECTIONS: Section[] = [
  {
    id: 'dress-code',
    title: 'Dress code',
    blocks: [
      { type: 'p', text: 'You represent both Georgian Water & Air and The Home Depot. Show up looking the part — every shift.' },
      { type: 'ul', items: [
        'Steel-toe shoes/boots — MANDATORY',
        'Home Depot badge — MANDATORY',
        'Apron — MANDATORY',
        'Only GWA or Home Depot related hats',
        'GWA shirt/sweater, business casual — no sweats, hoodies, crop tops, ripped jeans, or graphic tees',
      ] },
      { type: 'note', text: 'No steel-toe boots = you cannot be on the floor. It is a safety requirement and part of the Home Depot sign-in.' },
    ],
  },
  {
    id: 'what-to-bring',
    title: 'What you need to succeed',
    blocks: [
      { type: 'ul', items: [
        'Table cloth',
        '$25 gift card ballots',
        'Pens',
        '$25 gift card sign / product sign',
        'Prepared bottle bags to fill trees — make sure they have the correct store number on them',
      ] },
    ],
  },
  {
    id: 'signing-in',
    title: 'Signing in',
    blocks: [
      { type: 'p', text: 'When you arrive at The Home Depot, go to the customer service desk and say hello to whoever is working. If you don’t recognize them, introduce yourself:' },
      { type: 'note', text: '“Hello, I’m [your name] with Georgian Water and Air. I understand our display is packed behind the customer service counter — is it alright if I help myself / would you mind helping me access it?”' },
      { type: 'p', text: 'At customer service (the desk closest to the main entrance) there is a contractor/visitor sign-in QR code. Scan it with your phone’s camera and open the link. Select “Contractor” then “Next” and fill out the required fields (your name, the assigned sign-in email for your office, your manager’s name and email, and “Georgian Water and Air” as the organization). Check the box confirming no COVID symptoms and that you are wearing your steel-toe shoes, then “Sign in.”' },
      { type: 'note', text: 'SIGNING IN IS ESSENTIAL ON EACH AND EVERY VISIT, DUE TO LIABILITIES. Remember to sign OUT when you leave.' },
    ],
  },
  {
    id: 'expectations',
    title: 'Expectations & etiquette',
    blocks: [
      { type: 'p', text: 'Home Depot expects us to Greet, Engage, and Thank every customer. As a lead generator you are the first face the customer sees — leave a positive, lasting impression every time. Dress and act professionally, respectfully, and engagingly.' },
      { type: 'p', text: 'Our mission is to help customers better understand water treatment and its applications through in-home consultations and testing — assessing individual needs and creating a personalized solution.' },
      { type: 'ul', items: [
        'Phone use is for breaks only. Step away from the booth, out of view of customers, to use your phone. The ONLY time your phone should be used in front of customers is to help them find a product.',
        'Earbuds / AirPods / headphones are NOT permitted anywhere in the store — it is a safety concern, and you may be asked to leave.',
      ] },
    ],
  },
  {
    id: 'maintaining-area',
    title: 'Maintaining your area & supplies',
    blocks: [
      { type: 'p', text: 'We are responsible for maintaining our own supplies and area, including but not limited to:' },
      { type: 'ul', items: [
        'Filling ALL water test kit trees — label with the store number, 5 per branch, dust them, and place them in high-traffic areas (work with the MET team, who move equipment around).',
        'Tidying the area we set up — dust off the tablecloth (wash when necessary; talk to Sam), keep signs in good condition, dispose of all garbage, and sweep around our displays.',
        'Returning everything to the way it was before you arrived — or better.',
      ] },
      { type: 'p', text: 'These small things improve your odds of success by making a good impression, and they protect our relationship with The Home Depot and its team.' },
    ],
  },
  {
    id: 'the-pitch',
    title: 'How to get leads — the pitch',
    blocks: [
      { type: 'p', text: 'A proven intro:' },
      { type: 'note', text: '“Hey, how are you? (listen and respond enthusiastically) … Wonderful! Have you received your $25 gift card? (point to the free water test on the card) It comes with a FREE water test! It’s all part of Home Depot’s water awareness program. (flip card to survey) I’d just ask you to fill out the back of one of these.”' },
      { type: 'p', text: 'If they ask “I fill it out, then what?” or “What’s the catch?” — DO NOT PAUSE:' },
      { type: 'ul', items: [
        'Our office gives you a call to set up a time that works for you.',
        'We come to you, so you get ALL the results right on the spot.',
        'Anything found in high levels, we make recommendations to help improve your water — no cost or obligation.',
        'A great opportunity to learn about your water and get a $25 Home Depot gift card for your time.',
      ] },
    ],
  },
  {
    id: 'questions',
    title: 'Answering customer questions',
    blocks: [
      { type: 'p', text: '“What do you test for?” — We test anything inorganic in your water, like rock or metals.' },
      { type: 'p', text: '“Do you test for bacteria?” / “I just had my water tested, it’s clean.” — I’m glad to hear that! We do not test for organics / microbiological compounds. We test for inorganics and the long-term effects they MAY have on your home or appliances.' },
      { type: 'p', text: '“Are you going to try and sell me something?” — We are Home Depot Home Services’ water treatment specialists. We do in-home testing to guarantee any recommendation could actually solve an issue you may be experiencing. There is no cost or obligation; if you have a need and choose to work with us, wonderful. If not, you still receive your gift card for taking the time to learn about your water.' },
      { type: 'p', text: '“Do I fill up a bottle and bring it back here?” — No, we come to you and do the test with you at the kitchen sink, so you get all the results on the spot. Anything in high levels, we make recommendations to help — no cost or obligation.' },
    ],
  },
  {
    id: 'leads',
    title: 'Handling leads',
    blocks: [
      { type: 'p', text: 'Warm leads are better. If you want to run a lead, you can book it yourself on the spot or call and book the next day. If you’d rather someone else take it: (A) offer it to another sales rep, or (B) bring it to the office to book.' },
      { type: 'note', text: 'All leads need to go through the office before they can be paid. Be sure to put YOUR NAME on each lead.' },
    ],
  },
  {
    id: 'gift-card',
    title: 'Gift-card redemption issues',
    blocks: [
      { type: 'p', text: 'First ask the customer if they’ve had the water evaluation done yet.' },
      { type: 'p', text: 'If NO: It is a Home Depot requirement that a water test/evaluation be completed before the gift card can be issued. If they’re still interested, recommend they call the office (or get their number so the office can reschedule) — or book to run the demo yourself.' },
      { type: 'ul', items: [
        'If YES: help them check the email (and junk box). The gift card email is from “Guusto” and reads “You have received a $25 e-gift card to Home Depot.”',
        'If there’s no email: find the customer’s name in the group chat, confirm the email address is correct, and let them know a gift card will be sent the next BUSINESS day after 12pm (office closed Saturday and Sunday).',
        'Give the customer the office’s phone number for further concerns, and thank them for their patience.',
      ] },
    ],
  },
  {
    id: 'finding-products',
    title: 'Helping customers find products',
    blocks: [
      { type: 'p', text: 'You’re wearing both the GWA and Home Depot brand — in the customer’s mind you work for Home Depot. Always take the extra step to help them find what they need. Your phone should only be used to assist customers in finding products; keep the store browser or Home Depot app open so you can search quickly.' },
      { type: 'ul', items: [
        'Take the customer to the location of their product. On the way, it’s a perfect chance to explain why you’re there and offer a $25 gift card and water test — trust and respect are being built.',
        'If you can’t find something, bring the customer to the PRO desk / Customer Service / an associate in that area, sum up the customer’s needs, and thank both the associate and the customer.',
      ] },
    ],
  },
];

export const QUIZ: QuizQuestion[] = [
  { id: 'q-boots', q: 'Which of these is MANDATORY to be on the floor?', options: ['A graphic tee', 'Steel-toe shoes/boots', 'A personal ball cap', 'Headphones'], correct: 1 },
  { id: 'q-signin', q: 'How often must you sign in at the Home Depot contractor QR code?', options: ['Only on your first day', 'Once a week', 'On each and every visit', 'Only if a manager asks'], correct: 2 },
  { id: 'q-signout', q: 'When you leave for the day, you should…', options: ['Just go — no need to do anything', 'Sign out', 'Text the office only', 'Leave your badge at the desk'], correct: 1 },
  { id: 'q-headphones', q: 'Where may you wear earbuds / AirPods / headphones in the store?', options: ['Anywhere', 'Only at the booth', 'Only on breaks in the back', 'Nowhere — they are not permitted anywhere in the store'], correct: 3 },
  { id: 'q-phone', q: 'When is it OK to use your phone in front of customers?', options: ['To text friends', 'Only to help a customer find a product', 'During any slow period', 'Whenever the booth is quiet'], correct: 1 },
  { id: 'q-greet', q: 'What does Home Depot expect us to do with every customer?', options: ['Greet, Engage, and Thank', 'Ignore unless they approach', 'Only greet paying customers', 'Hand them a flyer and move on'], correct: 0 },
  { id: 'q-offer', q: 'What are you offering customers?', options: ['A paid plumbing inspection', 'A $25 gift card and a FREE water test', 'A discount coupon only', 'A product to buy on the spot'], correct: 1 },
  { id: 'q-test', q: 'What do we test the water for?', options: ['Bacteria and organics', 'Inorganics — like rock or metals', 'Only chlorine', 'Nothing — it’s just a survey'], correct: 1 },
  { id: 'q-giftcard', q: 'Before a customer’s $25 gift card can be issued, what must happen?', options: ['They buy a softener', 'A water test/evaluation must be completed', 'They sign a contract', 'Nothing — it’s automatic'], correct: 1 },
  { id: 'q-leads', q: 'What must you do with every lead?', options: ['Keep it to yourself', 'Put your name on it, and it goes through the office before it can be paid', 'Pay it out yourself', 'Throw it away if the customer seems unsure'], correct: 1 },
  { id: 'q-trees', q: 'When filling water-test-kit trees, you must…', options: ['Leave them blank', 'Label them with the store number', 'Hide them in the back', 'Put all of them in one aisle'], correct: 1 },
  { id: 'q-area', q: 'When you finish your shift, the area should be…', options: ['Left however it is', 'Returned the way it was before you arrived — or better', 'Packed up with garbage left behind', 'Someone else’s problem'], correct: 1 },
];

export const RULES: Rule[] = [
  { id: 'r-boots', text: 'I will always wear steel-toe shoes/boots on the floor.' },
  { id: 'r-badge', text: 'I will always wear my Home Depot badge.' },
  { id: 'r-apron', text: 'I will always wear my apron.' },
  { id: 'r-dress', text: 'I will follow the dress code (GWA shirt, business casual — no sweats, hoodies, crop tops, ripped jeans, or graphic tees).' },
  { id: 'r-headphones', text: 'I will not wear earbuds, AirPods, or headphones anywhere in the store.' },
  { id: 'r-phone', text: 'I will not use my phone in front of customers except to help them find a product.' },
  { id: 'r-signin', text: 'I will sign in at the contractor QR code on every visit, and sign out when I leave.' },
  { id: 'r-greet', text: 'I will Greet, Engage, and Thank every customer and act professionally.' },
  { id: 'r-area', text: 'I will keep my area clean and return everything the way it was, or better.' },
  { id: 'r-leads', text: 'I will put my name on every lead, and I understand all leads go through the office before being paid.' },
];

export type Lang = 'en' | 'fr';
export const LANGS: Lang[] = ['en', 'fr'];

// ---------------------------------------------------------------------------
// French (Canadian) content. The quiz and rules are a DISPLAY layer keyed by the
// same ids as the English (authoritative) structure, with the same option order,
// so scoring stays language-independent. A question/rule with no French entry
// (e.g. one an admin adds later) simply falls back to its English text.
// Brand names ("Georgian Water & Air", "The Home Depot", "Guusto", "MET") are
// kept as-is per the brand kit.
// ---------------------------------------------------------------------------
export const SECTIONS_FR: Section[] = [
  {
    id: 'dress-code',
    title: 'Code vestimentaire',
    blocks: [
      { type: 'p', text: 'Vous représentez à la fois Georgian Water & Air et The Home Depot. Présentez-vous en conséquence — à chaque quart de travail.' },
      { type: 'ul', items: [
        'Chaussures/bottes à embout d’acier — OBLIGATOIRE',
        'Badge Home Depot — OBLIGATOIRE',
        'Tablier — OBLIGATOIRE',
        'Seulement des casquettes liées à GWA ou à Home Depot',
        'Chandail GWA, tenue décontractée chic — pas de survêtements, de kangourous, de camisoles courtes, de jeans déchirés ni de t-shirts à imprimé',
      ] },
      { type: 'note', text: 'Pas de bottes à embout d’acier = vous ne pouvez pas être sur le plancher. C’est une exigence de sécurité et une partie de l’inscription chez Home Depot.' },
    ],
  },
  {
    id: 'what-to-bring',
    title: 'Ce qu’il vous faut pour réussir',
    blocks: [
      { type: 'ul', items: [
        'Nappe',
        'Bulletins pour la carte-cadeau de 25 $',
        'Stylos',
        'Affiche carte-cadeau 25 $ / affiche produit',
        'Sacs de bouteilles préparés pour remplir les présentoirs — assurez-vous qu’ils portent le bon numéro de magasin',
      ] },
    ],
  },
  {
    id: 'signing-in',
    title: 'S’inscrire à l’arrivée',
    blocks: [
      { type: 'p', text: 'En arrivant au Home Depot, rendez-vous au comptoir du service à la clientèle et saluez la personne en poste. Si vous ne la connaissez pas, présentez-vous :' },
      { type: 'note', text: '« Bonjour, je suis [votre nom] de Georgian Water and Air. Je crois que notre présentoir est rangé derrière le comptoir du service à la clientèle — puis-je m’en occuper moi-même ou pourriez-vous m’aider à y accéder? »' },
      { type: 'p', text: 'Au service à la clientèle (le comptoir le plus près de l’entrée principale) se trouve un code QR d’inscription pour les visiteurs/entrepreneurs. Scannez-le avec l’appareil photo de votre téléphone et ouvrez le lien. Choisissez « Contractor » puis « Next » et remplissez les champs requis (votre nom, l’adresse courriel d’inscription attribuée à votre bureau, le nom et le courriel de votre gérant, et « Georgian Water and Air » comme organisation). Cochez la case confirmant l’absence de symptômes de COVID et le port de vos chaussures à embout d’acier, puis « Sign in ».' },
      { type: 'note', text: 'L’INSCRIPTION EST ESSENTIELLE À CHAQUE VISITE, EN RAISON DES RESPONSABILITÉS LÉGALES. N’oubliez pas de vous DÉSINSCRIRE en partant.' },
    ],
  },
  {
    id: 'expectations',
    title: 'Attentes et savoir-vivre',
    blocks: [
      { type: 'p', text: 'Home Depot s’attend à ce que nous accueillions, engagions et remerciions chaque client. Comme générateur de pistes, vous êtes le premier visage que voit le client — laissez une impression positive et durable chaque fois. Habillez-vous et comportez-vous de façon professionnelle, respectueuse et engageante.' },
      { type: 'p', text: 'Notre mission est d’aider les clients à mieux comprendre le traitement de l’eau et ses applications grâce à des consultations et des tests à domicile — en évaluant les besoins individuels et en créant une solution personnalisée.' },
      { type: 'ul', items: [
        'Le téléphone ne sert qu’aux pauses. Éloignez-vous du kiosque, hors de la vue des clients, pour l’utiliser. Le SEUL moment où votre téléphone devrait être utilisé devant un client, c’est pour l’aider à trouver un produit.',
        'Les écouteurs / AirPods / casques d’écoute ne sont PAS permis où que ce soit dans le magasin — c’est une question de sécurité et on pourrait vous demander de quitter.',
      ] },
    ],
  },
  {
    id: 'maintaining-area',
    title: 'Entretien de votre aire et du matériel',
    blocks: [
      { type: 'p', text: 'Nous sommes responsables de l’entretien de notre matériel et de notre aire, notamment :' },
      { type: 'ul', items: [
        'Remplir TOUS les présentoirs de trousses d’analyse d’eau — les étiqueter avec le numéro de magasin, 5 par succursale, les épousseter et les placer dans les zones achalandées (collaborez avec l’équipe MET, qui déplace l’équipement).',
        'Garder notre aire en ordre — épousseter la nappe (la laver au besoin; parlez-en à Sam), garder les affiches en bon état, jeter tous les déchets et balayer autour de nos présentoirs.',
        'Tout remettre comme c’était avant votre arrivée — ou mieux.',
      ] },
      { type: 'p', text: 'Ces petits gestes augmentent vos chances de succès en faisant bonne impression, et ils protègent notre relation avec The Home Depot et son équipe.' },
    ],
  },
  {
    id: 'the-pitch',
    title: 'Comment obtenir des pistes — l’approche',
    blocks: [
      { type: 'p', text: 'Une introduction éprouvée :' },
      { type: 'note', text: '« Bonjour, comment allez-vous? (écoutez et répondez avec enthousiasme) … Parfait! Avez-vous reçu votre carte-cadeau de 25 $? (pointez l’analyse d’eau gratuite sur la carte) Elle vient avec une analyse d’eau GRATUITE! Tout ça fait partie du programme de sensibilisation à l’eau de Home Depot. (retournez la carte vers le sondage) Je vous demanderais simplement de remplir le verso de l’une de ces cartes. »' },
      { type: 'p', text: 'S’ils demandent « Je le remplis, et ensuite? » ou « C’est quoi le piège? » — NE FAITES PAS DE PAUSE :' },
      { type: 'ul', items: [
        'Notre bureau vous appelle pour fixer un moment qui vous convient.',
        'Nous venons chez vous, donc vous obtenez TOUS les résultats sur-le-champ.',
        'Pour tout élément trouvé en forte concentration, nous faisons des recommandations pour améliorer votre eau — sans frais ni obligation.',
        'Une belle occasion d’en apprendre sur votre eau et d’obtenir une carte-cadeau Home Depot de 25 $ pour votre temps.',
      ] },
    ],
  },
  {
    id: 'questions',
    title: 'Répondre aux questions des clients',
    blocks: [
      { type: 'p', text: '« Que testez-vous? » — Nous testons tout ce qui est inorganique dans votre eau, comme la roche ou les métaux.' },
      { type: 'p', text: '« Testez-vous les bactéries? » / « Je viens de faire tester mon eau, elle est propre. » — Tant mieux! Nous ne testons pas les composés organiques / microbiologiques. Nous testons les éléments inorganiques et les effets à long terme qu’ils POURRAIENT avoir sur votre maison ou vos appareils.' },
      { type: 'p', text: '« Allez-vous essayer de me vendre quelque chose? » — Nous sommes les spécialistes du traitement de l’eau de Home Depot Home Services. Nous faisons des tests à domicile pour garantir qu’une recommandation pourrait réellement régler un problème que vous vivez. Il n’y a ni frais ni obligation; si vous avez un besoin et choisissez de travailler avec nous, tant mieux. Sinon, vous recevez quand même votre carte-cadeau pour avoir pris le temps d’en apprendre sur votre eau.' },
      { type: 'p', text: '« Est-ce que je remplis une bouteille et je la rapporte ici? » — Non, nous venons chez vous et faisons le test avec vous à l’évier de la cuisine, pour que vous ayez tous les résultats sur-le-champ. Pour tout élément en forte concentration, nous faisons des recommandations pour aider — sans frais ni obligation.' },
    ],
  },
  {
    id: 'leads',
    title: 'Gestion des pistes',
    blocks: [
      { type: 'p', text: 'Les pistes « chaudes » sont préférables. Si vous voulez traiter une piste, vous pouvez la réserver vous-même sur-le-champ ou appeler pour la réserver le lendemain. Si vous préférez que quelqu’un d’autre s’en charge : (A) offrez-la à un autre représentant, ou (B) apportez-la au bureau pour la réserver.' },
      { type: 'note', text: 'Toutes les pistes doivent passer par le bureau avant de pouvoir être payées. Assurez-vous d’inscrire VOTRE NOM sur chaque piste.' },
    ],
  },
  {
    id: 'gift-card',
    title: 'Problèmes d’échange de carte-cadeau',
    blocks: [
      { type: 'p', text: 'Demandez d’abord au client s’il a déjà fait faire l’évaluation de l’eau.' },
      { type: 'p', text: 'Si NON : Home Depot exige qu’une analyse/évaluation de l’eau soit effectuée avant l’émission de la carte-cadeau. S’il est toujours intéressé, recommandez-lui d’appeler le bureau (ou prenez son numéro pour que le bureau le rappelle) — ou réservez pour faire la démonstration vous-même.' },
      { type: 'ul', items: [
        'Si OUI : aidez-le à vérifier son courriel (et le dossier indésirable). Le courriel de carte-cadeau provient de « Guusto » et indique « You have received a $25 e-gift card to Home Depot ».',
        'S’il n’y a pas de courriel : trouvez le nom du client dans la discussion de groupe, confirmez que l’adresse courriel est exacte, et indiquez-lui qu’une carte-cadeau sera envoyée le prochain jour OUVRABLE après 12 h (bureau fermé samedi et dimanche).',
        'Donnez au client le numéro de téléphone du bureau pour toute autre préoccupation, et remerciez-le de sa patience.',
      ] },
    ],
  },
  {
    id: 'finding-products',
    title: 'Aider les clients à trouver des produits',
    blocks: [
      { type: 'p', text: 'Vous portez les marques GWA et Home Depot — dans l’esprit du client, vous travaillez pour Home Depot. Faites toujours l’effort supplémentaire de l’aider à trouver ce dont il a besoin. Votre téléphone ne devrait servir qu’à aider les clients à trouver des produits; gardez le navigateur du magasin ou l’application Home Depot ouvert pour chercher rapidement.' },
      { type: 'ul', items: [
        'Accompagnez le client jusqu’à l’emplacement de son produit. En chemin, c’est le moment idéal pour expliquer pourquoi vous êtes là et offrir une carte-cadeau de 25 $ et une analyse d’eau — vous bâtissez la confiance et le respect.',
        'Si vous ne trouvez pas quelque chose, amenez le client au comptoir PRO / au service à la clientèle / à un associé de ce secteur, résumez ses besoins, et remerciez l’associé et le client.',
      ] },
    ],
  },
];

export const QUIZ_FR: Record<string, { q: string; options: string[] }> = {
  'q-boots': { q: 'Lequel de ces éléments est OBLIGATOIRE pour être sur le plancher?', options: ['Un t-shirt à imprimé', 'Des chaussures/bottes à embout d’acier', 'Une casquette personnelle', 'Des écouteurs'] },
  'q-signin': { q: 'À quelle fréquence devez-vous vous inscrire au code QR entrepreneur de Home Depot?', options: ['Seulement la première journée', 'Une fois par semaine', 'À chaque visite', 'Seulement si un gérant le demande'] },
  'q-signout': { q: 'Quand vous partez pour la journée, vous devez…', options: ['Partir, sans rien faire', 'Vous désinscrire', 'Texter le bureau seulement', 'Laisser votre badge au comptoir'] },
  'q-headphones': { q: 'Où pouvez-vous porter des écouteurs / AirPods / casques dans le magasin?', options: ['Partout', 'Seulement au kiosque', 'Seulement aux pauses à l’arrière', 'Nulle part — ils ne sont permis nulle part dans le magasin'] },
  'q-phone': { q: 'Quand peut-on utiliser son téléphone devant les clients?', options: ['Pour texter des amis', 'Seulement pour aider un client à trouver un produit', 'Pendant toute période creuse', 'Dès que le kiosque est tranquille'] },
  'q-greet': { q: 'Que Home Depot s’attend-il à ce que nous fassions avec chaque client?', options: ['Accueillir, engager et remercier', 'Ignorer sauf s’il approche', 'Accueillir seulement les clients payants', 'Lui remettre un dépliant et passer'] },
  'q-offer': { q: 'Qu’offrez-vous aux clients?', options: ['Une inspection de plomberie payante', 'Une carte-cadeau de 25 $ et une analyse d’eau GRATUITE', 'Un coupon de rabais seulement', 'Un produit à acheter sur-le-champ'] },
  'q-test': { q: 'Que testons-nous dans l’eau?', options: ['Bactéries et organiques', 'Éléments inorganiques — comme la roche ou les métaux', 'Seulement le chlore', 'Rien — c’est juste un sondage'] },
  'q-giftcard': { q: 'Avant d’émettre la carte-cadeau de 25 $ d’un client, que doit-il se passer?', options: ['Il achète un adoucisseur', 'Une analyse/évaluation de l’eau doit être effectuée', 'Il signe un contrat', 'Rien — c’est automatique'] },
  'q-leads': { q: 'Que devez-vous faire avec chaque piste?', options: ['La garder pour vous', 'Y inscrire votre nom; elle passe par le bureau avant d’être payée', 'La payer vous-même', 'La jeter si le client semble hésitant'] },
  'q-trees': { q: 'En remplissant les présentoirs de trousses d’analyse d’eau, vous devez…', options: ['Les laisser vides', 'Les étiqueter avec le numéro de magasin', 'Les cacher à l’arrière', 'Les mettre tous dans une seule allée'] },
  'q-area': { q: 'À la fin de votre quart, l’aire devrait être…', options: ['Laissée telle quelle', 'Remise comme elle était avant votre arrivée — ou mieux', 'Rangée avec des déchets laissés derrière', 'Le problème de quelqu’un d’autre'] },
};

export const RULES_FR: Record<string, string> = {
  'r-boots': 'Je porterai toujours des chaussures/bottes à embout d’acier sur le plancher.',
  'r-badge': 'Je porterai toujours mon badge Home Depot.',
  'r-apron': 'Je porterai toujours mon tablier.',
  'r-dress': 'Je respecterai le code vestimentaire (chandail GWA, tenue décontractée chic — pas de survêtements, kangourous, camisoles courtes, jeans déchirés ni t-shirts à imprimé).',
  'r-headphones': 'Je ne porterai pas d’écouteurs, d’AirPods ni de casque où que ce soit dans le magasin.',
  'r-phone': 'Je n’utiliserai pas mon téléphone devant les clients, sauf pour les aider à trouver un produit.',
  'r-signin': 'Je m’inscrirai au code QR entrepreneur à chaque visite et je me désinscrirai en partant.',
  'r-greet': 'J’accueillerai, j’engagerai et je remercierai chaque client, et j’agirai de façon professionnelle.',
  'r-area': 'Je garderai mon aire propre et je remettrai tout comme c’était, ou mieux.',
  'r-leads': 'J’inscrirai mon nom sur chaque piste, et je comprends que toutes les pistes passent par le bureau avant d’être payées.',
};

/** UI chrome strings for the public training flow, per language. */
export interface TrainingStrings {
  langName: string;
  brandTop: string; brandSub: string; title: string; office: string;
  steps: { info: string; learn: string; quiz: string; signoff: string };
  intakeTitle: string; intakeSub: string;
  fullName: string; phone: string; email: string; address: string;
  phName: string; phPhone: string; phEmail: string; phAddress: string;
  start: string; intakeConsent: string;
  errName: string; errEmail: string; errPhone: string; errGeneric: string;
  sectionOf: string; back: string; next: string; startQuiz: string;
  quizTitle: string; quizSub: string; review: string; continueScored: string; continuePlain: string; answerAll: string; quizBelow: string;
  signoffTitle: string; signoffSub: string; signLabel: string; phSign: string; signConsent: string;
  submitting: string; submit: string; tickAll: string;
  doneTitle: string; doneSub: string; certTitle: string; score: string;
  dateLabel: string; versionLabel: string; dealerLabel: string;
  signedBy: string; print: string; doneFoot: string;
}

export const STRINGS: Record<Lang, TrainingStrings> = {
  en: {
    langName: 'English',
    brandTop: 'Home Depot Home Services', brandSub: 'in-store training — serviced by Georgian Water & Air',
    title: 'Lead Generator Training', office: 'Office:',
    steps: { info: 'Your info', learn: 'Learn', quiz: 'Quiz', signoff: 'Sign off' },
    intakeTitle: 'Welcome! Let’s get you store-ready.',
    intakeSub: 'A quick, visual walkthrough of how to work a Home Depot booth, a short quiz, and a sign-off. Takes about 10–15 minutes.',
    fullName: 'Full name', phone: 'Phone', email: 'Email', address: 'Address',
    phName: 'Jamie Lee', phPhone: '705-555-0123', phEmail: 'you@email.com', phAddress: 'Street, city',
    start: 'Start training →',
    intakeConsent: 'We collect your name and contact details only to record that you completed this training.',
    errName: 'Please enter your full name.', errEmail: 'Please enter a valid email address.', errPhone: 'Please enter a valid phone number.', errGeneric: 'Something went wrong.',
    sectionOf: 'Section {i} of {n}', back: '← Back', next: 'Next →', startQuiz: 'Start the quiz →',
    quizTitle: 'Quick quiz', quizSub: 'Answer all {n}. You need {p}% to pass — you can retry.',
    review: '← Review', continueScored: 'Continue ({s}%) →', continuePlain: 'Continue →', answerAll: 'Answer all {n}',
    quizBelow: 'You’re at {s}%. Review the sections and adjust before signing.',
    signoffTitle: 'Sign off on the rules', signoffSub: 'Tick each one to confirm you understand, then sign.',
    signLabel: 'Type your full name to sign', phSign: 'Your full name',
    signConsent: 'By signing, I confirm I have read and understand the Home Depot in-store rules above and agree to follow them.',
    submitting: 'Submitting…', submit: 'Submit & get certified', tickAll: 'Tick all {n} rules to continue.',
    doneTitle: 'You’re certified! 🎉', doneSub: 'Nice work, {first}. Here’s your certificate of completion.',
    certTitle: 'Certificate of completion', score: 'Score {s}%',
    dateLabel: 'Date', versionLabel: 'Program version', dealerLabel: 'Office / dealer',
    signedBy: 'Signed by {sig}, who acknowledged all {n} Home Depot in-store rules. A full record (answers, score, acknowledgements, signature, time) has been saved for Home Depot compliance.',
    print: 'Print / save certificate', doneFoot: 'Your office can see your completion in their portal. You can close this page.',
  },
  fr: {
    langName: 'Français',
    brandTop: 'Home Depot Home Services', brandSub: 'formation en magasin — assurée par Georgian Water & Air',
    title: 'Formation du générateur de pistes', office: 'Bureau :',
    steps: { info: 'Vos infos', learn: 'Apprendre', quiz: 'Questionnaire', signoff: 'Engagement' },
    intakeTitle: 'Bienvenue! Préparons-vous pour le magasin.',
    intakeSub: 'Un parcours visuel rapide sur la façon de tenir un kiosque Home Depot, un court questionnaire et un engagement. Environ 10 à 15 minutes.',
    fullName: 'Nom complet', phone: 'Téléphone', email: 'Courriel', address: 'Adresse',
    phName: 'Jamie Lee', phPhone: '705-555-0123', phEmail: 'vous@courriel.com', phAddress: 'Rue, ville',
    start: 'Commencer la formation →',
    intakeConsent: 'Nous recueillons votre nom et vos coordonnées uniquement pour consigner que vous avez terminé cette formation.',
    errName: 'Veuillez entrer votre nom complet.', errEmail: 'Veuillez entrer une adresse courriel valide.', errPhone: 'Veuillez entrer un numéro de téléphone valide.', errGeneric: 'Une erreur est survenue.',
    sectionOf: 'Section {i} sur {n}', back: '← Retour', next: 'Suivant →', startQuiz: 'Commencer le questionnaire →',
    quizTitle: 'Court questionnaire', quizSub: 'Répondez aux {n}. Il faut {p} % pour réussir — vous pouvez réessayer.',
    review: '← Revoir', continueScored: 'Continuer ({s} %) →', continuePlain: 'Continuer →', answerAll: 'Répondez aux {n}',
    quizBelow: 'Vous êtes à {s} %. Revoyez les sections et ajustez avant de signer.',
    signoffTitle: 'Engagement envers les règles', signoffSub: 'Cochez chacune pour confirmer que vous comprenez, puis signez.',
    signLabel: 'Tapez votre nom complet pour signer', phSign: 'Votre nom complet',
    signConsent: 'En signant, je confirme avoir lu et compris les règles en magasin de Home Depot ci-dessus et je m’engage à les respecter.',
    submitting: 'Envoi…', submit: 'Soumettre et obtenir ma certification', tickAll: 'Cochez les {n} règles pour continuer.',
    doneTitle: 'Vous êtes certifié! 🎉', doneSub: 'Beau travail, {first}. Voici votre certificat de réussite.',
    certTitle: 'Certificat de réussite', score: 'Résultat {s} %',
    dateLabel: 'Date', versionLabel: 'Version du programme', dealerLabel: 'Bureau',
    signedBy: 'Signé par {sig}, qui a reconnu les {n} règles en magasin de Home Depot. Un dossier complet (réponses, résultat, reconnaissances, signature, heure) a été conservé pour la conformité Home Depot.',
    print: 'Imprimer / enregistrer le certificat', doneFoot: 'Votre bureau peut voir votre réussite dans son portail. Vous pouvez fermer cette page.',
  },
};

/** Sections for a language (French falls back to English if not translated). */
export function sectionsFor(lang: Lang): Section[] {
  return lang === 'fr' ? SECTIONS_FR : SECTIONS;
}

/** Localize a quiz for display WITHOUT changing ids or correct indices, so the
 *  same answers score identically in any language. Missing FR entries fall back
 *  to the English text. */
export function localizeQuiz(quiz: QuizQuestion[], lang: Lang): QuizQuestion[] {
  if (lang !== 'fr') return quiz;
  return quiz.map((q) => {
    const fr = QUIZ_FR[q.id];
    if (!fr) return q;
    // Only override options we have a translation for; keep length + order.
    const options = q.options.map((o, i) => fr.options[i] ?? o);
    return { ...q, q: fr.q, options };
  });
}

export function localizeRules(rules: Rule[], lang: Lang): Rule[] {
  if (lang !== 'fr') return rules;
  return rules.map((r) => ({ ...r, text: RULES_FR[r.id] ?? r.text }));
}

// ---------------------------------------------------------------------------
// Admin-editable override of the quiz + rules (the "test questionnaire we can
// insert"). Stored as JSON in app settings; the English structure is
// authoritative (see localize* above). These coercers keep a stored or
// submitted override well-formed so nothing downstream can break.
// ---------------------------------------------------------------------------
export interface TrainingOverride {
  quiz: QuizQuestion[];
  rules: Rule[];
}

function slug(s: string, fallback: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return base || fallback;
}

/** Coerce arbitrary input into a clean quiz: non-empty question, 2–6 non-empty
 *  options, a valid correct index, and a unique stable id per question. Invalid
 *  questions are dropped. */
export function coerceQuiz(input: unknown): QuizQuestion[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: QuizQuestion[] = [];
  input.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Record<string, unknown>;
    const q = typeof r.q === 'string' ? r.q.trim() : '';
    const options = Array.isArray(r.options) ? r.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean) : [];
    if (!q || options.length < 2 || options.length > 6) return;
    let correct = typeof r.correct === 'number' ? Math.floor(r.correct) : 0;
    if (correct < 0 || correct >= options.length) correct = 0;
    let id = typeof r.id === 'string' && r.id.trim() ? slug(r.id, `q-${idx + 1}`) : slug(q, `q-${idx + 1}`);
    while (seen.has(id)) id = `${id}-${idx + 1}`;
    seen.add(id);
    out.push({ id, q, options, correct });
  });
  return out;
}

/** Coerce arbitrary input into clean rules: non-empty text, unique stable id. */
export function coerceRules(input: unknown): Rule[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Rule[] = [];
  input.forEach((raw, idx) => {
    const text = typeof raw === 'string' ? raw.trim()
      : raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).text === 'string'
        ? ((raw as Record<string, unknown>).text as string).trim() : '';
    if (!text) return;
    const rid = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).id === 'string'
      ? ((raw as Record<string, unknown>).id as string).trim() : '';
    let id = rid ? slug(rid, `r-${idx + 1}`) : slug(text, `r-${idx + 1}`);
    while (seen.has(id)) id = `${id}-${idx + 1}`;
    seen.add(id);
    out.push({ id, text });
  });
  return out;
}

/** Score a completed quiz. `answers` maps questionId -> selected option index.
 *  `quiz` defaults to the built-in questions; pass the effective (admin-edited)
 *  quiz so a trainee is always scored against the questions they actually saw.
 *  Scoring is language-independent — it compares option indices, never text. */
export function scoreQuiz(
  answers: Record<string, number>,
  quiz: QuizQuestion[] = QUIZ,
): { correct: number; total: number; score: number; passed: boolean } {
  const total = quiz.length;
  let correct = 0;
  for (const question of quiz) {
    if (answers[question.id] === question.correct) correct += 1;
  }
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, score, passed: score >= PASS_THRESHOLD };
}

export interface TrainingSubmission {
  traineeName?: string;
  traineeEmail?: string;
  traineePhone?: string;
  traineeAddress?: string;
  answers?: Record<string, number>;
  acknowledged?: string[]; // rule ids checked
  signatureName?: string;
  lang?: Lang; // language the trainee completed in (display only; scoring is language-independent)
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Result returned by the public submit action. */
export interface SubmitResult {
  ok: boolean;
  error?: string;
  certificationId?: string;
  score?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate a submission before it can be stored. Enforces: contact info, every
 *  question answered, a passing score, EVERY rule acknowledged, and a signature. */
export function validateSubmission(
  s: TrainingSubmission,
  quiz: QuizQuestion[] = QUIZ,
  rules: Rule[] = RULES,
): ValidationResult {
  const name = (s.traineeName || '').trim();
  const email = (s.traineeEmail || '').trim();
  const phone = (s.traineePhone || '').replace(/\D/g, '');
  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (phone.length < 10) return { ok: false, error: 'Please enter a valid phone number.' };

  const answers = s.answers || {};
  for (const question of quiz) {
    if (typeof answers[question.id] !== 'number') {
      return { ok: false, error: 'Please answer every quiz question.' };
    }
  }
  const { passed, score } = scoreQuiz(answers, quiz);
  if (!passed) return { ok: false, error: `You scored ${score}%. You need ${PASS_THRESHOLD}% to pass — please review and try again.` };

  const acked = new Set(s.acknowledged || []);
  for (const rule of rules) {
    if (!acked.has(rule.id)) return { ok: false, error: 'Please acknowledge every rule before signing.' };
  }
  if ((s.signatureName || '').trim().length < 2) return { ok: false, error: 'Please type your name to sign.' };

  return { ok: true };
}
