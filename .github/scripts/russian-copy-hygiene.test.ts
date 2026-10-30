import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyTells } from './russian-copy-hygiene.ts';

test('an em dash in a Russian YAML string is a tell', () => {
  const yaml = 'hero:\n  heading: Цена — потом ремонт\n  lead: Чистый текст\n';
  assert.deepEqual(copyTells('home.yaml', yaml), ['Цена — потом ремонт']);
});

test('Ё and ё in a Russian YAML string are tells', () => {
  const yaml = 'items:\n  - Всё готово\n  - ЁЛКА\n  - Ок\n';
  assert.deepEqual(copyTells('home.yaml', yaml), ['Всё готово', 'ЁЛКА']);
});

test('translations and translatedFrom in YAML are not Russian source', () => {
  const yaml =
    'title: Чисто\ntranslations:\n  en:\n    title: Clean — done\ntranslatedFrom: abc\n';
  assert.deepEqual(copyTells('home.yaml', yaml), []);
});

test('every Russian string of a Work is Russian source, its translations are not', () => {
  const md =
    '---\ntitle: Ремонт — быстро\ncar: Ё-мобиль\nseo:\n  description: Всё сделали\nparts:\n  - brand: BOSCH\n    number: 0 242 — 236\ntranslations:\n  en:\n    title: Fix — fast\ntranslatedFrom: ё\n---\nТело с ё.\n\nЧисто.\n';
  assert.deepEqual(copyTells('index.md', md), [
    'Ремонт — быстро',
    'Ё-мобиль',
    'Всё сделали',
    'Тело с ё.',
  ]);
});

test('slugs, numbers and part numbers of a Work are not Russian source', () => {
  const md =
    '---\ntitle: Ок\nslug: bmw—x5\nyear: 2021\nparts:\n  - number: HU 816 — x\n---\nЧисто.\n';
  assert.deepEqual(copyTells('index.md', md), []);
});

test('clean copy has no tells', () => {
  assert.deepEqual(
    copyTells('index.md', '---\ntitle: Ок\n---\nТекст - дефис.\n'),
    [],
  );
});
