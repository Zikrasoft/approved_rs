import { isLatin, translit } from '../translit';

describe('spelling a Russian name in the Latin alphabet', () => {
  it.each([
    ['Аккумулятор тест', 'akkumulyator-test'],
    ['Установка аккумулятора', 'ustanovka-akkumulyatora'],
    ['Масло «Лукойл» 5W-30', 'maslo-lukojl-5w-30'],
    ['Жёлтый щенок', 'zhyoltyj-shenok'],
  ])('spells %s as %s', (given, expected) => {
    expect(translit(given)).toBe(expected);
  });

  it('lower-cases a name already written in Latin', () => {
    expect(translit('Varta Blue Dynamic E12')).toBe('varta-blue-dynamic-e12');
  });

  it('gives nothing back for a name of punctuation only', () => {
    expect(translit('«»')).toBe('');
  });

  it('knows an address it can put in a URL', () => {
    expect(isLatin('akkumulyator-test')).toBe(true);
    expect(isLatin('аккумулятор')).toBe(false);
    expect(isLatin('Akkumulyator')).toBe(false);
  });
});
