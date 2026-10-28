import { serbianScripts } from '../serbian';

describe('serbianScripts', () => {
  it('writes a Latin name in both scripts, digraphs included', () => {
    expect(serbianScripts('Prečistač ulja, džep')).toEqual({
      latin: 'prečistač ulja, džep',
      cyrillic: 'пречистач уља, џеп',
    });
  });

  it('writes a Cyrillic name in both scripts', () => {
    expect(serbianScripts('Филтер Уља')).toEqual({
      latin: 'filter ulja',
      cyrillic: 'филтер уља',
    });
  });
});
