import { plainDescription } from '../ai/description';

describe('plain description', () => {
  it('drops every sentence that makes a claim, and empty paragraphs with them', () => {
    expect(
      plainDescription(
        'Трос стояночного тормоза SWAG 33 10 0331, длина 1171 мм. Подходит для Alfa Romeo 147.\n\nЭтот трос обеспечивает надежное функционирование тормоза. Изготовлен из качественных материалов.',
        'Трос стояночного тормоза SWAG 33 10 0331',
      ),
    ).toBe(
      'Трос стояночного тормоза SWAG 33 10 0331, длина 1171 мм. Подходит для Alfa Romeo 147.',
    );
  });

  it('opens with the part name in place of a first sentence that makes a claim', () => {
    expect(
      plainDescription(
        'Масляный фильтр MANN-FILTER HU 7032 z обеспечивает надежную защиту. Высота 75 мм.',
        'Масляный фильтр MANN-FILTER HU 7032 z',
      ),
    ).toBe('Масляный фильтр MANN-FILTER HU 7032 z. Высота 75 мм.');
  });

  it('starts with a capital letter', () => {
    expect(
      plainDescription(
        'масляный фильтр MANN-FILTER HU 7032 z. Высота 75 мм.',
        'Масляный фильтр MANN-FILTER HU 7032 z',
      ),
    ).toBe('Масляный фильтр MANN-FILTER HU 7032 z. Высота 75 мм.');
  });

  it('leaves nothing of a description that only makes claims', () => {
    expect(
      plainDescription('Надежная защита. Высокое качество.', 'Фильтр W 1'),
    ).toBe('');
  });

  it('leaves a description without claims as it is', () => {
    const text =
      'Втулка стабилизатора febi 41997 из резины.\n\nВнутренний диаметр 25 мм.';
    expect(plainDescription(text, 'Втулка стабилизатора febi 41997')).toBe(
      text,
    );
  });
});
