export const REGIONS = {
  regions: [{ id: 'reg_01M3NFBY260Y5FR0AGNGD9J5T0', currency_code: 'rsd' }],
};

export const VERSION = { version: '2026-09-29T02:20:01.701Z' };

export const BATTERY = {
  id: 'prod_01M3NFC1R2Y6JTSVFM5DHMY5DG',
  handle: 'bosch-s4-024',
  title: 'Bosch S4 024',
  description: '**Obrnuta polaritet** za japanske modele.',
  thumbnail:
    'http://localhost:9009/static/products/1790648387322-bosch-s4-024.png',
  metadata: {
    spec: {
      brand: 'Bosch',
      widthMm: 175,
      heightMm: 175,
      lengthMm: 242,
      polarity: 'left',
      crankingA: 540,
      capacityAh: 60,
      warrantyMonths: 24,
    },
    fitment: [
      { make: 'Toyota', model: 'Corolla', yearTo: 2019, yearFrom: 2013 },
    ],
    translated_from_en: '53d6fb84a813d618',
    translated_from_sr: '53d6fb84a813d618',
  },
  type: { value: 'batteries' },
  images: [
    {
      id: 'img_01M3NFC1R49K8S0CR8MJH5NZSK',
      url: 'http://localhost:9009/static/products/1790648387322-bosch-s4-024.png',
    },
  ],
  variants: [
    {
      id: 'variant_01M3NFC1VA4DD30F9DBKDBPSBJ',
      sku: 'BOSCH-S4-024',
      title: 'Default',
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 4,
      calculated_price: { calculated_amount: 11190, currency_code: 'rsd' },
    },
  ],
};

export const INSTALLATION = {
  id: 'prod_01M3NFBYAMPRXP697MZNJB61BJ',
  handle: 'battery-installation',
  title: 'Установка аккумулятора',
  description: null,
  thumbnail: null,
  metadata: null,
  type: { value: 'services' },
  images: [],
  variants: [
    {
      id: 'variant_01M3NFBYD4R1DVY0FKR0RJ08YB',
      sku: 'BATTERY-INSTALLATION',
      title: 'Default',
      manage_inventory: false,
      allow_backorder: false,
      calculated_price: { calculated_amount: 1500, currency_code: 'rsd' },
    },
  ],
};

export const battery = (handle: string, patch: object = {}) => ({
  ...structuredClone(BATTERY),
  id: `prod_${handle}`,
  handle,
  variants: [
    {
      ...structuredClone(BATTERY.variants[0]),
      id: `variant_${handle}`,
      sku: handle.toUpperCase(),
    },
  ],
  ...patch,
});

export const products = (list: object[], count = list.length) => ({
  products: list,
  count,
  limit: 1000,
  offset: 0,
});
