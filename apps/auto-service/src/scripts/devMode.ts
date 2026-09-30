export const DEV_STORAGE_KEY = 'carlab_dev';

export function applyDevMode(): void {
  const key = 'carlab_dev';
  const root = document.documentElement;
  const flag = new URLSearchParams(location.search).get('dev');
  root.toggleAttribute('data-dev', flag === 'true');
  try {
    if (flag === 'true') localStorage.setItem(key, '1');
    else if (flag === 'false') localStorage.removeItem(key);
    else root.toggleAttribute('data-dev', localStorage.getItem(key) === '1');
  } catch {
    return;
  }
}

export const DEV_MODE_INLINE = `(${applyDevMode})()`;
