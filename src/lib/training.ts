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

/** Score a completed quiz. `answers` maps questionId -> selected option index. */
export function scoreQuiz(answers: Record<string, number>): { correct: number; total: number; score: number; passed: boolean } {
  const total = QUIZ.length;
  let correct = 0;
  for (const question of QUIZ) {
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
export function validateSubmission(s: TrainingSubmission): ValidationResult {
  const name = (s.traineeName || '').trim();
  const email = (s.traineeEmail || '').trim();
  const phone = (s.traineePhone || '').replace(/\D/g, '');
  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (phone.length < 10) return { ok: false, error: 'Please enter a valid phone number.' };

  const answers = s.answers || {};
  for (const question of QUIZ) {
    if (typeof answers[question.id] !== 'number') {
      return { ok: false, error: 'Please answer every quiz question.' };
    }
  }
  const { passed, score } = scoreQuiz(answers);
  if (!passed) return { ok: false, error: `You scored ${score}%. You need ${PASS_THRESHOLD}% to pass — please review and try again.` };

  const acked = new Set(s.acknowledged || []);
  for (const rule of RULES) {
    if (!acked.has(rule.id)) return { ok: false, error: 'Please acknowledge every rule before signing.' };
  }
  if ((s.signatureName || '').trim().length < 2) return { ok: false, error: 'Please type your name to sign.' };

  return { ok: true };
}
