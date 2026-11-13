import { rememberVin } from '@podbor/site-kit/browser';
import { vinFrom } from '@/utils/carFacts';
import { rememberCar } from './garageCar';

export function defineCarFacts(tagName = 'car-facts'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const vin = vinFrom(location.search);
        if (!vin) return;
        rememberVin(vin);
        const { car, make, series, model } = this.dataset;
        if (car) rememberCar({ vin, car, make, series, model });
      }
    },
  );
}
