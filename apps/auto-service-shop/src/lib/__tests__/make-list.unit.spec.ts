import { makeListJson } from '../make-list';

describe('the exported Make list', () => {
  it('holds each Make as only its slug and name, ordered by name', () => {
    expect(
      JSON.parse(
        makeListJson([
          { id: 'make_2', slug: 'skoda', name: 'Škoda' },
          { id: 'make_1', slug: 'bmw', name: 'BMW' },
          { id: 'make_3', slug: 'seat', name: 'SEAT' },
          { id: 'make_4', slug: 'alfa-romeo', name: 'alfa romeo' },
        ]),
      ),
    ).toEqual([
      { slug: 'alfa-romeo', name: 'alfa romeo' },
      { slug: 'bmw', name: 'BMW' },
      { slug: 'seat', name: 'SEAT' },
      { slug: 'skoda', name: 'Škoda' },
    ]);
  });

  it('ends the file with a newline', () => {
    expect(makeListJson([])).toBe('[]\n');
  });
});
