import { describe, it, expect } from 'vitest';
import {
  articleSchema,
  faqPageSchema,
  jsonLdText,
  localBusinessSchema,
  pageSchema,
  serviceSchema,
} from './jsonLd.ts';

describe('pageSchema', () => {
  it('hands the canonical to a schema that needs the page url', () => {
    expect(pageSchema((url) => ({ url }), 'https://x.rs/ru/a/')).toEqual({
      url: 'https://x.rs/ru/a/',
    });
  });

  it('passes a finished schema through', () => {
    const schema = { '@type': 'Thing' };
    expect(pageSchema(schema, 'https://x.rs/ru/a/')).toBe(schema);
  });
});

describe('faqPageSchema', () => {
  it('maps each item to a question with its answer', () => {
    expect(faqPageSchema([{ q: 'Why?', a: 'Because.' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Why?',
          acceptedAnswer: { '@type': 'Answer', text: 'Because.' },
        },
      ],
    });
  });
});

describe('jsonLdText', () => {
  it('serialises a schema object', () => {
    expect(jsonLdText({ '@type': 'Thing', name: 'X' })).toBe(
      '{"@type":"Thing","name":"X"}',
    );
  });

  it('escapes a closing script tag hidden in a string', () => {
    const text = jsonLdText({ name: '</script><img src=x onerror=alert(1)>' });
    expect(text).not.toContain('</script>');
    expect(text).toContain('\\u003c/script');
  });

  it('escapes every angle bracket, not just the first', () => {
    expect(jsonLdText({ a: '<', b: '<' })).toBe(
      '{"a":"\\u003c","b":"\\u003c"}',
    );
  });

  it('still parses back to the same object', () => {
    const schema = { name: 'a <b> c', nested: { list: ['<x>'] } };
    expect(JSON.parse(jsonLdText(schema))).toEqual(schema);
  });

  it('leaves a schema with no angle brackets untouched', () => {
    expect(jsonLdText({ n: 1 })).toBe('{"n":1}');
  });
});

const org = { '@type': 'Organization', name: 'Acme' };

describe('serviceSchema', () => {
  it('builds a Service with its keys in a stable order', () => {
    const schema = serviceSchema({
      name: 'Brakes',
      serviceType: 'Brakes',
      description: 'Pads and discs',
      provider: org,
      areaServed: ['RS'],
      url: 'https://x.test/brakes',
    });
    expect(JSON.stringify(schema)).toBe(
      '{"@context":"https://schema.org","@type":"Service","name":"Brakes","serviceType":"Brakes","description":"Pads and discs","provider":{"@type":"Organization","name":"Acme"},"areaServed":["RS"],"url":"https://x.test/brakes"}',
    );
  });

  it('leaves the optional fields out of the serialised output', () => {
    const text = jsonLdText(
      serviceSchema({ name: 'N', provider: org, areaServed: 'RS', url: 'u' }),
    );
    expect(text).toBe(
      '{"@context":"https://schema.org","@type":"Service","name":"N","provider":{"@type":"Organization","name":"Acme"},"areaServed":"RS","url":"u"}',
    );
  });
});

describe('articleSchema', () => {
  it('names the publisher as the author and serialises the date', () => {
    const schema = articleSchema({
      headline: 'H',
      description: 'D',
      image: 'https://x.test/i.jpg',
      datePublished: new Date('2026-01-02T00:00:00Z'),
      publisher: { '@id': 'https://x.test/#org' },
      url: 'https://x.test/a',
    });
    expect(JSON.stringify(schema)).toBe(
      '{"@context":"https://schema.org","@type":"Article","headline":"H","description":"D","image":"https://x.test/i.jpg","datePublished":"2026-01-02T00:00:00.000Z","author":{"@id":"https://x.test/#org"},"publisher":{"@id":"https://x.test/#org"},"mainEntityOfPage":"https://x.test/a"}',
    );
  });
});

describe('localBusinessSchema', () => {
  it('builds the address, geo and opening hours from plain values', () => {
    const schema = localBusinessSchema({
      type: 'AutoRepair',
      id: 'https://x.test/#shop',
      name: 'X',
      legalName: 'X d.o.o.',
      url: 'https://x.test',
      image: 'https://x.test/og.png',
      logo: 'https://x.test/logo.png',
      description: 'Tagline',
      telephone: '+381',
      address: {
        street: 'Main 1',
        district: 'Zvezdara',
        city: 'Beograd',
        country: 'RS',
        lat: 44.8,
        lon: 20.4,
      },
      hasMap: 'https://maps.test/1',
      areaServed: 'Beograd',
      currenciesAccepted: 'RSD, EUR',
      openingHours: [{ days: ['Monday'], opens: '09:00', closes: '18:00' }],
      sameAs: ['https://maps.test/1'],
    });
    expect(JSON.stringify(schema)).toBe(
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'AutoRepair',
        '@id': 'https://x.test/#shop',
        name: 'X',
        legalName: 'X d.o.o.',
        url: 'https://x.test',
        image: 'https://x.test/og.png',
        logo: 'https://x.test/logo.png',
        description: 'Tagline',
        telephone: '+381',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Main 1',
          addressLocality: 'Beograd',
          addressRegion: 'Zvezdara',
          addressCountry: 'RS',
        },
        geo: { '@type': 'GeoCoordinates', latitude: 44.8, longitude: 20.4 },
        hasMap: 'https://maps.test/1',
        areaServed: 'Beograd',
        currenciesAccepted: 'RSD, EUR',
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday'],
            opens: '09:00',
            closes: '18:00',
          },
        ],
        sameAs: ['https://maps.test/1'],
      }),
    );
  });

  it('leaves the optional fields out of the serialised output', () => {
    const text = jsonLdText(
      localBusinessSchema({
        type: 'LocalBusiness',
        id: 'i',
        name: 'N',
        url: 'u',
        address: {
          street: 's',
          district: 'd',
          city: 'c',
          country: 'RS',
          lat: 1,
          lon: 2,
        },
      }),
    );
    expect(text).toBe(
      '{"@context":"https://schema.org","@type":"LocalBusiness","@id":"i","name":"N","url":"u","address":{"@type":"PostalAddress","streetAddress":"s","addressLocality":"c","addressRegion":"d","addressCountry":"RS"},"geo":{"@type":"GeoCoordinates","latitude":1,"longitude":2}}',
    );
  });
});
