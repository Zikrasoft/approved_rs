import { describe, expect, it } from 'vitest';
import { createRedirectMatcher } from '@podbor/site-kit/redirects';
import { EDGE_REDIRECTS, REDIRECTS } from './redirects';

const redirectFor = createRedirectMatcher(REDIRECTS);
const edgeRedirectFor = createRedirectMatcher(EDGE_REDIRECTS);

describe('REDIRECTS', () => {
  it.each([
    ['/es/vykup/de/', '/es/vehicle-buyback/'],
    ['/vykup/pl', '/ru/vehicle-buyback/'],
    ['/en/vykup/rs/', '/en/vehicle-buyback/rs'],
    ['/es/vehicle-buyback/de/', '/es/vehicle-buyback/'],
    ['/de/proverka/rs/', '/de/vehicle-inspection/rs'],
    ['/es/privoz/', '/es/vehicle-import/'],
    ['/en/autopodbor/de/', '/en/vehicle-sourcing/de'],
    ['/autopodbor/de', '/ru/vehicle-sourcing/de'],
    ['/en/cases/autopodbor', '/en/cases/vehicle-sourcing'],
    ['/de/cases/vykup/', '/de/cases/vehicle-buyback'],
    ['/privoz/de/', '/ru/vehicle-import/eu/de/'],
    ['/en/privoz/de', '/en/vehicle-import/eu/de/'],
    ['/en/vehicle-import/de', '/en/vehicle-import/eu/de/'],
    ['/sr/vehicle-import/de/', '/sr/vehicle-import/eu/de/'],
    ['/en/vehicle-buyback/pl', '/en/vehicle-buyback/'],
    ['/vehicle-buyback/it/', '/ru/vehicle-buyback/'],
    ['/cases/', '/ru/cases/vehicle-sourcing'],
    ['/cases/bmw-x5-2023-de', '/ru/cases/vehicle-sourcing'],
    ['/de/autopodbor/', '/ru/vehicle-sourcing/de'],
    ['/es/combined', '/ru/vehicle-sourcing/es'],
    ['/rs/dostavka/', '/ru/vehicle-sourcing/rs'],
    ['/de/berlin/autopodbor/', '/ru/vehicle-sourcing/de/berlin'],
    ['/pl/krakow/autopodbor', '/ru/vehicle-sourcing/pl/krakow'],
    ['/ru/auto-service-belgrade/', 'https://carlab.rs/ru/services/'],
    ['/sr/detailing-belgrade/', 'https://details.rs/sr/services/'],
    ['/ru/auto-service-belgrade/bmw-x3/', 'https://carlab.rs/ru/works/bmw-x3/'],
    ['/ru/wrapping-belgrade/bmw-x5', 'https://details.rs/ru/works/bmw-x5/'],
    ['/de/detailing-belgrade/bmw-x5/', 'https://details.rs/en/works/bmw-x5/'],
    ['/es/avtoservis-belgrade', 'https://carlab.rs/en/services/'],
    ['/avtoservis-belgrade/', 'https://carlab.rs/ru/services/'],
    ['/en/cases/auto-service', 'https://carlab.rs/en/works/'],
    ['/de/cases/autoservice/', 'https://carlab.rs/en/works/'],
    ['/cases/detailing', 'https://details.rs/ru/works/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each([
    '/',
    '/ru/',
    '/en/vehicle-sourcing/de/',
    '/ru/vehicle-buyback/',
    '/ru/vehicle-buyback/rs/',
    '/en/vehicle-import/eu/de/',
    '/ru/cases/vehicle-import/',
    '/ru/constructor/',
    '/ru/cases/toString/',
    '/vehicle-sourcing/rs/',
    '/llms.txt',
  ])('leaves %s alone', (path) => {
    expect(redirectFor(path)).toBeNull();
  });
});

describe('EDGE_REDIRECTS', () => {
  it.each([
    ['/vehicle-sourcing/rs/', '/ru/vehicle-sourcing/rs'],
    ['/contacts', '/ru/contacts/'],
    ['/thanks/', '/ru/thanks/'],
    ['/cases/bmw-x3', '/ru/cases/bmw-x3'],
  ])('prefixes the unprefixed %s with the primary locale', (path, target) => {
    expect(edgeRedirectFor(path)).toBe(target);
  });

  it('leaves /llms.txt alone', () => {
    expect(edgeRedirectFor('/llms.txt')).toBeNull();
  });
});
