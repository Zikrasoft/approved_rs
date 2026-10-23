export const SHOP_PREVIEW_HEADER = 'x-shop-preview';
export const SHOP_PREVIEW_FIELD = 'shop_preview';

const STORAGE_KEY = 'carlab_shop_preview';
const PARAM = 'df';
const ON = '1';

type PreviewStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function shopPreview(
  search = location.search,
  storage?: PreviewStorage,
): boolean {
  const asked = new URLSearchParams(search).get(PARAM);
  try {
    const store = storage ?? localStorage;
    if (asked === ON) store.setItem(STORAGE_KEY, ON);
    if (asked === '0') store.removeItem(STORAGE_KEY);
    return store.getItem(STORAGE_KEY) === ON;
  } catch {
    return asked === ON;
  }
}

export const previewHeaders = (
  search?: string,
  storage?: PreviewStorage,
): Record<string, string> =>
  shopPreview(search, storage) ? { [SHOP_PREVIEW_HEADER]: ON } : {};
