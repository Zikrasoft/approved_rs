import type { Dictionary } from './ru';

export const es: Dictionary = {
  nav: {
    'vehicle-sourcing': 'Búsqueda de autos',
    'vehicle-import': 'Autos desde la UE y China',
    'auto-service-belgrade': 'Taller mecánico',
    'detailing-belgrade': 'Detailing',
    'vehicle-buyback': 'Compra de autos',
    'vehicle-inspection': 'Inspección',
    cases: 'Casos',
    contacts: 'Contacto',
    moreServices: 'Más servicios',
  },
  header: {
    menuLabel: 'Menú',
    languageLabel: 'Idioma',
    themeToggleLabel: 'Cambiar tema',
    themeToggleMobileLabel: 'Cambiar tema',
    ctaShort: 'Solicitud',
    ctaLong: 'Dejar una solicitud',
  },
  footer: {
    servicesHeading: 'Servicios',
    companyHeading: 'Empresa',
    privacyLabel: 'Privacidad',
    tagline:
      'Buscamos, inspeccionamos y entregamos tu auto desde Europa. Nos encargamos de todo el proceso, desde la búsqueda hasta la entrega.',
    contactManagerLabel: 'Escribir a un asesor',
    hoursLine: 'Disponibles 24/7, todos los días',
    copyrightSuffix: 'Búsqueda, mantenimiento y entrega de autos desde Europa',
    channelLinkLabel: 'Nuestro canal',
  },
  common: {
    otherServicesLabel: 'Otros servicios:',
    alsoWorkingInLabel: 'También trabajamos en:',
    homeLabel: 'Inicio',
    faqHeading: 'Preguntas frecuentes',
    whereFromLabel: '¿De dónde eres?',
    otherCountryLabel: 'Otro país',
    viewAllCasesLabel: 'Ver todos los casos',
    closeLabel: 'Cerrar',
    channelLabel: 'Nuestro canal',
    cookie: {
      notice:
        'Usamos cookies analíticas (Google Analytics) para entender cómo los visitantes usan el sitio.',
      more: 'Más información en nuestra',
      policyLink: 'política de privacidad',
      accept: 'Aceptar',
      decline: 'Rechazar',
    },
    gallery: {
      morePhotos: 'Más fotos',
      prev: 'Foto anterior',
      next: 'Foto siguiente',
      altTemplate: (name: string, i: number) => `${name}, foto ${i + 1}`,
      openAriaTemplate: (i: number, total: number) =>
        `Abrir foto ${i + 1} de ${total}`,
      showMoreTemplate: (n: number) => `Ver más (${n})`,
    },
  },
};
