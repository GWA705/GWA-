/**
 * Acquired Home Depot stores, grouped by the dealer ("Office") that owns them.
 * Source: the "Stores Numbers and Attached Office" sheet — only the acquired
 * offices (every "Not yet aquired/TBD" store and the Quebec block are excluded).
 *
 * Used by the Admin "Import HD stores" action, which is idempotent: it creates
 * any missing dealer/store and never duplicates an existing one.
 */
export interface DealerStores {
  dealer: string;
  stores: { number: string; city: string }[];
}

export const HD_STORE_IMPORT: DealerStores[] = [
  {
    dealer: 'Georgian Water and Air',
    stores: [
      { number: '7135', city: 'Aurora' },
      { number: '7024', city: 'Barrie' },
      { number: '7164', city: 'Bracebridge' },
      { number: '7264', city: 'Bradford' },
      { number: '7234', city: 'Collingwood' },
      { number: '7244', city: 'Huntsville' },
      { number: '7247', city: 'Midland' },
      { number: '7030', city: 'Newmarket' },
      { number: '7137', city: 'Orillia' },
      { number: '7154', city: 'Owen Sound' },
      { number: '7226', city: 'Parry Sound' },
    ],
  },
  {
    dealer: 'Essential Water and Air',
    stores: [
      { number: '7133', city: 'Belleville' },
      { number: '7085', city: 'Brockville' },
      { number: '7081', city: 'Kingston' },
      { number: '7251', city: 'Cobourg' },
      { number: '7116', city: 'Peterborough' },
      { number: '7079', city: 'Barrhaven' },
      { number: '7263', city: 'Carleton Place' },
      { number: '7075', city: 'Cornwall' },
      { number: '7025', city: 'Gloucester' },
      { number: '7108', city: 'Kanata' },
      { number: '7118', city: 'Orleans' },
      { number: '7026', city: 'Nepean' },
      { number: '7242', city: 'Pembroke' },
      { number: '7158', city: 'South Keys' },
    ],
  },
  {
    dealer: 'Home Service Providers',
    stores: [
      { number: '7178', city: 'Chatham' },
      { number: '7009', city: 'North London (Fanshawe)' },
      { number: '7237', city: 'London East (Clarke Rd)' },
      { number: '7153', city: 'Sarnia' },
      { number: '7182', city: 'Woodstock' },
      { number: '7228', city: 'Windsor' },
      { number: '7184', city: 'Windsor East' },
      { number: '7033', city: 'London SW (Wonderland)' },
    ],
  },
  {
    dealer: 'Hamilton',
    stores: [
      { number: '7138', city: 'Brantford' },
      { number: '7174', city: 'Niagara Falls' },
      { number: '7023', city: 'St. Catharines' },
    ],
  },
  {
    dealer: 'TRUE NORTH',
    stores: [
      { number: '7022', city: 'Sudbury' },
      { number: '7034', city: 'Sault Ste Marie' },
    ],
  },
  {
    dealer: 'LAKEHEAD',
    stores: [{ number: '7102', city: 'Thunder Bay' }],
  },
  {
    dealer: 'Nipissing Water and Air',
    stores: [{ number: '7160', city: 'North Bay' }],
  },
  {
    dealer: 'Oasis',
    stores: [
      { number: '7064', city: 'West End' },
      { number: '7065', city: 'South Common' },
      { number: '7062', city: 'Clareview' },
      { number: '7119', city: 'Skyview' },
      { number: '7117', city: 'Strathcona' },
      { number: '7227', city: 'Westmont' },
      { number: '7248', city: 'Whitemud' },
      { number: '7268', city: 'Windermere' },
      { number: '7172', city: 'Sherwood' },
      { number: '7050', city: 'Spruce Grove' },
      { number: '7088', city: 'St. Albert' },
      { number: '7222', city: 'Fort Saskatchewan' },
    ],
  },
  {
    dealer: 'Clean Air and Water Services',
    stores: [
      { number: '7067', city: 'Shawnessy' },
      { number: '7250', city: 'Tuscany' },
      { number: '7076', city: 'Beacon Hill' },
      { number: '7254', city: 'Airdrie' },
      { number: '7131', city: 'Red Deer' },
      { number: '7223', city: 'Okotoks' },
      { number: '7036', city: 'Medicine Hat' },
      { number: '7170', city: 'Lethbridge' },
    ],
  },
  {
    dealer: 'SIC Calgary',
    stores: [
      { number: '7111', city: 'Country Hills' },
      { number: '7082', city: 'Calgary SE' },
      { number: '7063', city: 'Chinook' },
      { number: '7061', city: 'Marlborough' },
      { number: '7037', city: 'North Hill' },
    ],
  },
  {
    dealer: 'Burnaby',
    stores: [
      { number: '7141', city: 'Abbotsford' },
      { number: '7273', city: 'Chilliwack' },
      { number: '7041', city: 'Langley' },
      { number: '7043', city: 'Richmond' },
    ],
  },
  {
    dealer: 'Kelowna',
    stores: [
      { number: '7032', city: 'Kelowna' },
      { number: '7252', city: 'West Bank' },
      { number: '7084', city: 'Vernon' },
    ],
  },
  {
    dealer: 'Regina',
    stores: [
      { number: '7245', city: 'Regina NW' },
      { number: '7052', city: 'Regina' },
    ],
  },
  {
    dealer: 'Winnipeg',
    stores: [
      { number: '7057', city: 'Polo Park' },
      { number: '7056', city: 'Cross Roads' },
      { number: '7180', city: 'Winnipeg North' },
    ],
  },
  {
    dealer: 'Aerus NS',
    stores: [
      { number: '7261', city: 'New Minas' },
      { number: '7126', city: 'Halifax' },
      { number: '7257', city: 'Dartmouth' },
      { number: '7151', city: 'Sydney' },
    ],
  },
  {
    dealer: 'Aerus NB',
    stores: [
      { number: '7103', city: 'Saint John' },
      { number: '7233', city: 'Fredericton' },
      { number: '7148', city: 'Moncton' },
    ],
  },
  {
    dealer: 'Aerus NL',
    stores: [{ number: '7077', city: "St. John's" }],
  },
  {
    dealer: 'Aerus PEI',
    stores: [{ number: '7173', city: 'Charlottetown' }],
  },
];
