export interface Car {
  make: string;
  model?: string;
  year?: number;
}

export const CAR_STORAGE_KEY = 'carlab_car';
export const CAR_EVENT = 'carlab:car';

export function readCar(): Car | null {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(CAR_STORAGE_KEY) ?? 'null',
    );
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const { make, model, year } = raw as Record<string, unknown>;
    if (typeof make !== 'string' || make === '') return null;
    return {
      make,
      ...(typeof model === 'string' && model !== '' && { model }),
      ...(typeof year === 'number' && Number.isInteger(year) && { year }),
    };
  } catch {
    return null;
  }
}

export function writeCar(car: Car | null): void {
  try {
    if (car) localStorage.setItem(CAR_STORAGE_KEY, JSON.stringify(car));
    else localStorage.removeItem(CAR_STORAGE_KEY);
  } catch (error) {
    console.warn('[car] not saved on this device', error);
  }
  window.dispatchEvent(new CustomEvent<Car | null>(CAR_EVENT, { detail: car }));
}
