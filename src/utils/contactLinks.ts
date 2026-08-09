export function whatsappLink(number: string, text: string | null): string {
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
}

// Viber's deep-link scheme has no reliable prefilled-text param, unlike tg/wa.
export function viberLink(number: string): string {
  return `viber://chat?number=%2B${number}`;
}
