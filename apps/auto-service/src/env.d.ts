/// <reference types="astro/client" />

declare module 'virtual:parts-hub' {
  const hub: import('./utils/partsHub').PartsHub;
  export default hub;
}
