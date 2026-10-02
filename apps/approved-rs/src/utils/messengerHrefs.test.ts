import { describe, it, expect } from 'vitest';
import { messengerHrefs } from './messengerHrefs';
import { TG_MANAGER } from './constants';

describe('messengerHrefs', () => {
  it('prefills both messengers in the visitor locale', () => {
    const ru = messengerHrefs('ru');
    const sr = messengerHrefs('sr');
    expect(ru.telegram).toContain(`t.me/${TG_MANAGER}?text=`);
    expect(ru.whatsapp).toContain('wa.me/');
    expect(ru.whatsapp).toContain('?text=');
    expect(sr.telegram).not.toBe(ru.telegram);
    expect(decodeURIComponent(sr.telegram)).toContain('Zdravo');
  });

  it('takes the Telegram handle the caller names', () => {
    expect(messengerHrefs('ru', 'someone').telegram).toContain(
      't.me/someone?text=',
    );
  });
});
