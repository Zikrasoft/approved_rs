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

test('a Work body and title are Russian source', () => {
  const md =
    '---\ntitle: Ремонт — быстро\ncar: Ё-мобиль\ntranslations:\n  en:\n    title: Fix — fast\n---\nТело с ё.\n\nЧисто.\n';
  assert.deepEqual(copyTells('index.md', md), ['Ремонт — быстро', 'Тело с ё.']);
});

test('clean copy has no tells', () => {
  assert.deepEqual(
    copyTells('index.md', '---\ntitle: Ок\n---\nТекст - дефис.\n'),
    [],
  );
});
