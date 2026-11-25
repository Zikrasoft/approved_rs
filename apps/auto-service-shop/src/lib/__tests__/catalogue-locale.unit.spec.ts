import { localizedCategory } from '../catalogue-locale';

describe('localizedCategory', () => {
  const category = {
    name: 'Масла',
    text: 'Про масла',
    service_label: 'Замена масла',
    translations: {
      sr: { name: 'Ulja', text: 'O uljima', service_label: 'Zamena ulja' },
    },
    fields: [
      {
        label: 'Вязкость',
        translations: { sr: { label: 'Viskozitet' } },
        options: [
          { label: 'Летнее', translations: { sr: { label: 'Letnje' } } },
        ],
      },
    ],
  };

  it('names everything in the locale and keeps only the service translations a parts list carries across locales', () => {
    expect(localizedCategory(category, 'sr')).toEqual({
      ...category,
      name: 'Ulja',
      text: 'O uljima',
      translations: { sr: { service_label: 'Zamena ulja' } },
      fields: [
        {
          label: 'Viskozitet',
          translations: null,
          options: [{ label: 'Letnje', translations: null }],
        },
      ],
    });
  });

  it('falls back to the source and drops empty translations', () => {
    expect(
      localizedCategory({ ...category, translations: null, fields: [] }, 'en'),
    ).toMatchObject({ name: 'Масла', text: 'Про масла', translations: null });
  });
});
