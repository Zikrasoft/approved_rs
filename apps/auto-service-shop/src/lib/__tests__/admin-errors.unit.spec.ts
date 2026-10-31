import en from '../../admin/i18n/translations/en.json';
import ru from '../../admin/i18n/translations/ru.json';
import { ADMIN_ERROR_CODES } from '../admin-errors';

describe('admin error codes', () => {
  it.each([
    ['ru', ru],
    ['en', en],
  ])('each code the backend returns has %s copy in the admin', (_, copy) => {
    expect(Object.keys(copy.errors.codes).sort()).toEqual(
      [...ADMIN_ERROR_CODES].sort(),
    );
  });
});
