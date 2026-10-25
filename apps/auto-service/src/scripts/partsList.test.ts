// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineModalDialog } from '@podbor/site-kit/browser';
import {
  addToPartsList,
  definePartsInquiry,
  definePartsListAdd,
  clearPartsList,
  inquiryComment,
  forgetListCar,
  listCar,
  listedPartSchema,
  partLine,
  readPartsList,
  removeFromPartsList,
  setPartAddon,
} from './partsList';
import { PARTS_LIST_STORAGE_KEY } from './cartBadge';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const mannOil = {
  slug: 'mann-filter-hu816x',
  brand: 'Mann-Filter',
  number: 'HU 816 x',
  name: 'Масляный фильтр',
};
const bmwOil = {
  slug: 'bmw-11428575211',
  brand: 'BMW',
  number: '11 42 8575211',
  name: 'Масляный фильтр',
};

describe('parts list', () => {
  it('keeps added parts for the next page load', () => {
    const storage = memoryStorage();

    addToPartsList(mannOil, storage);
    addToPartsList(bmwOil, storage);

    expect(
      readPartsList(
        memoryStorage({
          [PARTS_LIST_STORAGE_KEY]: storage.getItem(PARTS_LIST_STORAGE_KEY)!,
        }),
      ),
    ).toEqual([mannOil, bmwOil]);
  });

  it('lists a brand-number once however often it is added', () => {
    const storage = memoryStorage();

    addToPartsList(mannOil, storage);
    addToPartsList(mannOil, storage);

    expect(readPartsList(storage)).toEqual([mannOil]);
  });

  it('removes one part and clears the rest', () => {
    const storage = memoryStorage();
    addToPartsList(mannOil, storage);
    addToPartsList(bmwOil, storage);

    removeFromPartsList(mannOil.slug, storage);
    expect(readPartsList(storage)).toEqual([bmwOil]);

    clearPartsList(storage);
    expect(readPartsList(storage)).toEqual([]);
  });

  it.each(['not json', '{"slug":1}', '[{"slug":"x"}]'])(
    'reads a damaged list %j as empty',
    (stored) => {
      expect(
        readPartsList(memoryStorage({ [PARTS_LIST_STORAGE_KEY]: stored })),
      ).toEqual([]);
    },
  );

  it('names the car only while every listed part was picked for it', () => {
    const storage = memoryStorage();
    const forBmw = { car: 'BMW 320d F30', vin: 'WBA35BG070N074158' };

    addToPartsList({ ...bmwOil, ...forBmw }, storage);
    expect(listCar(readPartsList(storage))).toEqual(forBmw);

    addToPartsList(mannOil, storage);
    expect(listCar(readPartsList(storage))).toBeNull();
  });

  it('moves a part to the car it was added for last', () => {
    const storage = memoryStorage();

    addToPartsList({ ...bmwOil, car: 'BMW 320d F30' }, storage);
    addToPartsList({ ...bmwOil, car: 'BMW 520d G30' }, storage);

    expect(readPartsList(storage)).toEqual([
      { ...bmwOil, car: 'BMW 520d G30' },
    ]);
  });

  it('forgets the car and keeps the parts', () => {
    const storage = memoryStorage();
    addToPartsList(
      { ...bmwOil, car: 'BMW 320d F30', vin: 'WBA35BG070N074158' },
      storage,
    );

    forgetListCar(storage);

    expect(readPartsList(storage)).toEqual([bmwOil]);
    expect(listCar(readPartsList(storage))).toBeNull();
  });

  it('keeps how many of a part the visitor wanted', () => {
    const storage = memoryStorage();

    addToPartsList(
      listedPartSchema.parse({ ...mannOil, quantity: '2' }),
      storage,
    );

    expect(readPartsList(storage)).toEqual([{ ...mannOil, quantity: 2 }]);
    expect(partLine(readPartsList(storage)[0])).toBe(
      'Mann-Filter HU 816 x, Масляный фильтр × 2',
    );
    expect(partLine({ ...mannOil, quantity: 1 })).toBe(
      'Mann-Filter HU 816 x, Масляный фильтр',
    );
  });

  it('keeps the add-on service of a part and whether the visitor wants it', () => {
    const storage = memoryStorage();
    addToPartsList(
      listedPartSchema.parse({
        ...bmwOil,
        car: 'BMW 320d F30',
        addon: 'Регистрация аккумулятора',
      }),
      storage,
    );

    setPartAddon(bmwOil.slug, true, storage);
    forgetListCar(storage);

    expect(readPartsList(storage)).toEqual([
      { ...bmwOil, addon: 'Регистрация аккумулятора', with_addon: true },
    ]);

    setPartAddon(bmwOil.slug, false, storage);
    expect(readPartsList(storage)[0].with_addon).toBe(false);
  });

  it('works as an empty list when storage is blocked', () => {
    expect(() => addToPartsList(mannOil, blockedStorage)).not.toThrow();
    expect(() => clearPartsList(blockedStorage)).not.toThrow();
    expect(() => forgetListCar(blockedStorage)).not.toThrow();
    expect(readPartsList(blockedStorage)).toEqual([]);
  });
});

describe('inquiryComment', () => {
  const more = (count: number) => `+${count} не поместились`;

  it('carries the car and one line per part before the visitor note', () => {
    expect(
      inquiryComment({
        parts: [mannOil, bmwOil].map((part) => ({
          ...part,
          car: 'BMW 320d F30',
        })),
        note: 'Нужно к пятнице',
        limit: 2000,
        more,
      }),
    ).toBe(
      [
        'BMW 320d F30',
        'Mann-Filter HU 816 x, Масляный фильтр',
        'BMW 11 42 8575211, Масляный фильтр',
        'Нужно к пятнице',
      ].join('\n'),
    );
  });

  it('lists a wanted add-on service under its part', () => {
    expect(
      inquiryComment({
        parts: [
          { ...bmwOil, addon: 'Регистрация аккумулятора', with_addon: true },
          { ...mannOil, addon: 'Регистрация аккумулятора', with_addon: false },
        ],
        note: '',
        limit: 2000,
        more,
      }),
    ).toBe(
      [
        'BMW 11 42 8575211, Масляный фильтр',
        '+ Регистрация аккумулятора',
        'Mann-Filter HU 816 x, Масляный фильтр',
      ].join('\n'),
    );
  });

  it('names the car on each line when the parts were picked for different cars', () => {
    expect(
      inquiryComment({
        parts: [
          { ...bmwOil, car: 'BMW 320d F30', vin: 'WBA35BG070N074158' },
          { ...mannOil, car: 'BMW 520d G30' },
          { ...mannOil, slug: 'other' },
        ],
        note: '',
        limit: 2000,
        more,
      }),
    ).toBe(
      [
        'BMW 11 42 8575211, Масляный фильтр (BMW 320d F30, VIN WBA35BG070N074158)',
        'Mann-Filter HU 816 x, Масляный фильтр (BMW 520d G30)',
        'Mann-Filter HU 816 x, Масляный фильтр',
      ].join('\n'),
    );
  });

  it('leaves out the car and the note when there are none', () => {
    expect(
      inquiryComment({
        parts: [mannOil],
        note: '  ',
        limit: 2000,
        more,
      }),
    ).toBe('Mann-Filter HU 816 x, Масляный фильтр');
  });

  it('cuts the list at the limit and counts the parts left out', () => {
    const parts = Array.from({ length: 5 }, (_, index) => ({
      slug: `bmw-${index}`,
      brand: 'BMW',
      number: `1000${index}`,
      name: 'Фильтр',
      car: 'BMW X5',
    }));

    const comment = inquiryComment({
      parts,
      note: '',
      limit: 60,
      more,
    });

    expect(comment).toBe(
      [
        'BMW X5',
        'BMW 10000, Фильтр',
        'BMW 10001, Фильтр',
        '+3 не поместились',
      ].join('\n'),
    );
    expect(comment.length).toBeLessThanOrEqual(60);
  });

  it('keeps the part lines and shortens a note too long to fit', () => {
    const comment = inquiryComment({
      parts: [mannOil],
      note: 'x'.repeat(100),
      limit: 50,
      more,
    });

    expect(comment.length).toBe(50);
    expect(comment.startsWith('Mann-Filter HU 816 x, Масляный фильтр\n')).toBe(
      true,
    );
    expect(comment.endsWith('x…')).toBe(true);
  });
});

describe('Подобрать on a part page', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    HTMLDialogElement.prototype.showModal ??= function (
      this: HTMLDialogElement,
    ) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
    definePartsListAdd();
    definePartsInquiry();
    defineModalDialog('parts-inquiry-modal');
  });

  const partPage = () => {
    document.body.innerHTML = `
      <parts-list-add
        data-slug="${mannOil.slug}"
        data-brand="${mannOil.brand}"
        data-number="${mannOil.number}"
        data-name="${mannOil.name}"
      >
        <a href="/ru/parts/#parts-inquiry" data-open-parts-inquiry>Подобрать</a>
      </parts-list-add>
      <parts-inquiry-modal trigger="[data-open-parts-inquiry]">
        <dialog>
          <button type="button" data-modal-close>×</button>
          <parts-inquiry>
            <div data-parts-list-block hidden>
              <ul data-parts-list></ul>
              <template data-parts-item><li><a data-part-link></a></li></template>
            </div>
            <form>
              <input name="contact" value="+381601234567" />
              <input name="vin" />
              <textarea name="comment"></textarea>
            </form>
          </parts-inquiry>
        </dialog>
      </parts-inquiry-modal>
    `;
    return {
      button: document.querySelector<HTMLElement>('[data-open-parts-inquiry]')!,
      dialog: document.querySelector('dialog')!,
      form: document.querySelector('form')!,
    };
  };

  it('adds the part and opens the inquiry form with it listed', () => {
    const { button, dialog } = partPage();

    button.click();

    expect(readPartsList()).toEqual([mannOil]);
    expect(dialog.open).toBe(true);
    expect(
      [...dialog.querySelectorAll('[data-part-link]')].map(
        (link) => link.textContent,
      ),
    ).toEqual(['Mann-Filter HU 816 x, Масляный фильтр']);
  });

  it('lets the visitor close the form and keep the part', () => {
    const { button, dialog } = partPage();

    button.click();
    dialog.querySelector<HTMLElement>('[data-modal-close]')!.click();

    expect(dialog.open).toBe(false);
    expect(readPartsList()).toEqual([mannOil]);
  });

  it('sends the listed parts with only a contact and no VIN', () => {
    const { button, form } = partPage();
    button.click();

    const formData = new FormData(form);
    form.dispatchEvent(Object.assign(new Event('formdata'), { formData }));

    expect(form.checkValidity()).toBe(true);
    expect(formData.get('vin')).toBe('');
    expect(formData.get('comment')).toBe(
      'Mann-Filter HU 816 x, Масляный фильтр',
    );
  });
});
