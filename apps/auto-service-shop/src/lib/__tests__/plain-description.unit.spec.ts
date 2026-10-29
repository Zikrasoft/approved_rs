import { plainDescription } from '../ai/description';

describe('plain description', () => {
  it('drops every sentence after the first that makes a claim, and empty paragraphs with them', () => {
    expect(
      plainDescription(
        'Трос стояночного тормоза SWAG 33 10 0331, длина 1171 мм. Подходит для Alfa Romeo 147.\n\nЭтот трос обеспечивает надежное функционирование тормоза. Изготовлен из качественных материалов.',
      ),
    ).toBe(
      'Трос стояночного тормоза SWAG 33 10 0331, длина 1171 мм. Подходит для Alfa Romeo 147.',
    );
  });

  it('keeps the first sentence and starts it with a capital letter', () => {
    expect(
      plainDescription(
        'масляный фильтр MANN-FILTER HU 7032 z обеспечивает надежную защиту. Высота 75 мм.',
      ),
    ).toBe(
      'Масляный фильтр MANN-FILTER HU 7032 z обеспечивает надежную защиту. Высота 75 мм.',
    );
  });

  it('leaves a description without claims as it is', () => {
    const text =
      'Втулка стабилизатора febi 41997 из резины.\n\nВнутренний диаметр 25 мм.';
    expect(plainDescription(text)).toBe(text);
  });
});
