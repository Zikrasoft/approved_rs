export interface Crumb {
  label: string;
  href?: string;
}

// A trailing crumb is the current page, so schema.org wants it named but not
// linked; anything before it that has no href is a label-only step and gets
// the same treatment.
export function breadcrumbListSchema(siteUrl: string, trail: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      ...(crumb.href && i < trail.length - 1
        ? { item: `${siteUrl}${crumb.href}` }
        : {}),
    })),
  };
}
