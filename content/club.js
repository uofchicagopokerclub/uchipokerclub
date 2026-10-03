// Everything a board member updates lives in this one file.
// Edit it on GitHub (pencil icon), commit to main, and Vercel redeploys the site in about a minute.
// Dates are YYYY-MM-DD, times are 24-hour HH:MM in Chicago time.
// House style: no em dashes or en dashes anywhere. The build refuses to run if one sneaks in.

// Change these each term. apps-script/Code.gs has matching TERM and YEARS, and `npm test` fails
// if the two ever disagree.
const TERM = 'Fall 2026';
const YEARS = ['2027', '2028', '2029', '2030', 'Other'];

export const club = {
  name: 'UChicago Poker Club',
  fullName: 'University of Chicago Undergraduate Poker Club',
  siteUrl: 'https://www.uchipokerclub.com',
  email: 'UofChicagoPokerClub@gmail.com',
  instagram: { handle: '@UChicagoPokerClub', url: 'https://www.instagram.com/uchicagopokerclub/' },
  x: { handle: '@UChiPokerClub', url: 'https://x.com/UChiPokerClub' },
  disclaimer: 'No money is wagered at any point. Chips are for scoring only.',
};

// The ledger backend is the club Google Sheet's Apps Script web app.
// Paste the URL ending in /exec here once it is deployed (see DEPLOY.md).
export const ledger = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxYZvdjack1k37nt65gfvpGeYxAgtuESABKKAebbAWg5R12d5ydFZ0o9CUsfRjjJ_Fw/exec',
  term: TERM,
  years: YEARS,
  payouts: [400, 225, 150, 100, 75, 50],
  rowsBeforeShowAll: 25,
  prizeNote: 'The top 6 at the end of the term receive Visa gift cards.',
  explainer: 'Paper profit and loss. Stacks reset every week and the ledger carries over. No money is wagered at any point. Chips are for scoring only.',
};

export const home = {
  eyebrow: 'University of Chicago',
  title: 'The UChicago Poker Club',
  lead: 'A strategy lecture from the board every week, then everyone plays. No experience needed to walk in.',
  heroImage: {
    src: '/images/hero-table.webp',
    srcSet: '/images/hero-table-800.webp 800w, /images/hero-table-1200.webp 1200w, /images/hero-table.webp 1800w',
    width: 1800,
    height: 1200,
    alt: 'Three club members mid-hand at a poker table in a wood-paneled room',
  },
  meetingNote: 'Bring nothing. Everyone is welcome, whatever you know about the game.',
  pillars: [
    {
      title: 'Learn how to play',
      text: 'Every week starts with a strategy lecture from the board, then everyone plays. We also host in-person tournaments.',
    },
    {
      title: 'Professional opportunities',
      text: 'We partner with the quant trading firms that recruit hardest at UChicago. They run events with us, meet members in person, and receive the advanced cohort resume book at the end of the term.',
    },
    {
      title: 'Community',
      text: 'A room full of people who want to get better at the same game. No experience needed to walk in.',
    },
  ],
  ledgerText: 'Every member starts each meeting with 10,000 chips. A board member verifies final stacks and records each result here, and results add up across the term.',
};

export const cohort = {
  title: 'Advanced cohort',
  lead: 'After the Fall term we select roughly 25 students for the advanced cohort.',
  text: 'The club is open to all students through weekly workshops and free-roll tournaments designed to sharpen analytical thinking and decision-making skills.',
  get: [
    'Priority access to all future tournaments and events.',
    'Your resume goes to our corporate sponsors.',
    'Custom merch.',
    'Special tournaments.',
  ],
  select: [
    'Selection is based mainly on engagement and participation at Fall events.',
    'There is a short application.',
    "Participation in last year's advanced cohort is also taken into account.",
  ],
};

export const about = {
  title: 'The University of Chicago Poker Club',
  lead: 'The University of Chicago Undergraduate Poker Club provides a fun, spirited learning environment for poker enthusiasts and novices alike. All levels are welcome.',
  body: [
    "We aim to build members' analytical and mathematical skills through poker strategy, with an emphasis on understanding the decision-making process.",
    'Weekly sessions teach new players the basics and GTO (game theory optimal) play, with the goal of reducing variance and improving long-term results.',
  ],
  // Source: the club's 2026-2027 sponsorship prospectus.
  facts: [
    { value: 'Winter 2024', label: 'Founded' },
    { value: '430+', label: 'Students on the mailing list, Fall 2026' },
    { value: 'About 40', label: 'Members of the 2025-2026 advanced cohort' },
  ],
  meeting: [
    {
      title: 'Lecture, first 35 minutes',
      text: 'A board member walks through key concepts and strategy. Bring questions. Everything is built to be followed from your first week.',
    },
    {
      title: 'Live play',
      text: 'Every member starts each session with 10,000 chips.',
    },
    {
      title: 'Paper profit and loss',
      text: "A board member verifies final stacks and records each player's result in the ledger on this site. Stacks reset every week, and results add up across the term.",
    },
  ],
};

export const schedule = {
  term: TERM,
  meetings: [
    { date: '2026-10-09', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
    { date: '2026-10-16', start: '18:00', end: '20:00', place: 'Reynolds Club, McCormick Tribune Lounge', what: 'Weekly meeting' },
    { date: '2026-10-22', start: '18:30', end: '20:00', place: 'Ida Noyes Hall, Library and Lounge', what: 'Bid or Bluff with Susquehanna', event: true },
    { date: '2026-10-23', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
    { date: '2026-10-30', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
    { date: '2026-11-06', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
    { date: '2026-11-08', start: '10:30', end: '13:30', place: 'Ida Noyes Hall, Library and Lounge', what: 'Fall tournament', event: true },
    { date: '2026-11-13', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
    { date: '2026-11-20', start: '18:00', end: '20:00', place: 'Reynolds Club, Hutchinson Commons', what: 'Weekly meeting' },
  ],
  afterLast: 'The Winter schedule goes up here once it is set.',
};

export const events = [
  {
    date: '2026-10-22',
    title: 'Bid or Bluff with Susquehanna',
    points: [
      'An evening of food, networking, and competition with Susquehanna for a select group of UChicago students.',
      'Bid or Bluff is a fast-paced game of strategy, deduction, and nerve. Prizes include a Nintendo Switch 2.',
      'Apply with your resume by October 13 through the link in the club email. Selected attendees get the details.',
    ],
  },
  {
    date: '2026-11-08',
    title: 'Fall tournament',
    points: [
      '48 seats. Some are selected by the board. The rest are won through an online satellite that anyone in the club can enter.',
      'A $1,000 prize pool paid out to the final table.',
      'Registration details are coming soon.',
    ],
  },
];

// The 2026-2027 board, from the Fall 2026 info session deck.
export const board = {
  season: '2026-2027',
  members: [
    { name: 'Max Lacombe', role: 'Co-President', year: '2028', photo: '/images/board/max-lacombe-2.webp' },
    { name: 'Zach Khambatta', role: 'Co-President', year: '2028', photo: '/images/board/zach-khambatta.webp' },
    { name: 'Levi Stein', role: 'Co-Head of Education', year: '2028', photo: '/images/board/levi-stein.webp' },
    { name: "Tad O'Brien", role: 'Co-Head of Education', year: '2028', photo: '/images/board/tad-obrien.webp' },
    { name: 'Noah Kahn', role: 'VP Communications', year: '2027', photo: '/images/board/noah-kahn.webp' },
    { name: 'Jesse Roonprapunt', role: 'VP Growth', year: '2028', photo: '/images/board/jesse-roonprapunt.webp' },
    { name: 'Mihir Shrestha', role: 'VP Events', year: '2028', photo: '/images/board/mihir-shrestha.webp' },
    { name: 'Max Linton', role: 'VP Events', year: '2029', photo: '/images/board/max-linton.webp' },
    { name: 'Dylan Dolotta', role: 'VP Events', year: '2029', photo: '/images/board/dylan-dolotta.webp' },
  ],
};

// Logos are the firms' own marks, shown at a height that balances them visually.
export const sponsors = {
  heading: '2025-2026 sponsors',
  note: 'These firms sponsored the club in 2025 to 2026. Sponsors for this year are being finalized.',
  cta: 'Become a sponsor',
  firms: [
    { name: 'Jane Street', logo: '/images/sponsors/jane-street.png', width: 424, height: 155, displayHeight: 40 },
    { name: 'Citadel', logo: '/images/sponsors/citadel.png', width: 350, height: 198, displayHeight: 48 },
    { name: 'Hudson River Trading', logo: '/images/sponsors/hrt.png', width: 292, height: 170, displayHeight: 42 },
    { name: 'Bridgewater', logo: '/images/sponsors/bridgewater.png', width: 345, height: 153, displayHeight: 40 },
    { name: 'Susquehanna', logo: '/images/sponsors/susquehanna.png', width: 546, height: 45, displayHeight: 18 },
  ],
};

export const gallery = [
  { src: '/images/gallery/photo-3.webp', width: 1400, height: 934, alt: 'A member smiles while holding his cards at the table' },
  { src: '/images/gallery/photo-2.webp', width: 933, height: 1400, alt: 'A member watches a hand from her seat, with onlookers behind her' },
  { src: '/images/gallery/photo-7.webp', width: 933, height: 1400, alt: 'A player in a navy cap follows the action from his seat' },
  { src: '/images/gallery/photo-1.webp', width: 1400, height: 934, alt: "A player stacks chips on the club's printed felt" },
  { src: '/images/gallery/photo-6.webp', width: 1400, height: 934, alt: 'A player peeks at a pair of aces' },
  { src: '/images/gallery/photo-8.webp', width: 639, height: 426, alt: 'A member weighs his next move at the table' },
  { src: '/images/gallery/photo-4.webp', width: 1400, height: 934, alt: 'A crowd gathers around a table as a player checks his cards' },
  { src: '/images/gallery/photo-5.webp', width: 1400, height: 788, alt: 'Three members at the table during a club game' },
];

export const contact = {
  title: 'Interested in learning more or becoming a sponsor?',
  sponsorTitle: 'Become a sponsor',
  sponsorText: 'Our 2026-2027 sponsorship prospectus covers partnership options and who our members are. Leave your details and a member of the board will reach out.',
};

export const mailingList = {
  title: 'Join our mailing list',
  success: 'Welcome to the club, we will be in touch.',
};
