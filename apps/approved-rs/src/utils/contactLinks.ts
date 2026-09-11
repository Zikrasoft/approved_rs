export function whatsappLink(number: string): string {
  return `https://wa.me/${number}`;
}

// Viber's deep-link scheme has no reliable prefilled-text param, unlike tg/wa.
export function viberLink(number: string): string {
  return `viber://chat?number=%2B${number}`;
}
