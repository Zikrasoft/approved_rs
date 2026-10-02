// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LEAD_FORM_RESULT_EVENT,
  submitLeadForm,
  type LeadFormResult,
} from './submitLeadForm.ts';

const ACTION = `${document.baseURI.replace(/\/$/, '')}/api/leads`;

let assign: ReturnType<typeof vi.fn>;
let results: boolean[];

function form(): HTMLFormElement {
  document.body.innerHTML = `
    <form method="POST" action="/api/leads">
      <input name="contact" value="+381641234567" />
    </form>`;
  const element = document.querySelector('form')!;
  element.addEventListener(LEAD_FORM_RESULT_EVENT, (event) => {
    results.push((event as CustomEvent<LeadFormResult>).detail.ok);
  });
  return element;
}

const answer = (status: number, url = '') =>
  vi.fn().mockResolvedValue({
    ok: status < 400,
    redirected: status < 400,
    url,
  } as Response);

beforeEach(() => {
  results = [];
  assign = vi.fn();
  vi.stubGlobal('location', { assign, href: document.baseURI });
});

describe('submitLeadForm', () => {
  it('posts the form where its action points and follows the thanks redirect', async () => {
    const fetchMock = answer(200, 'http://localhost:3000/ru/thanks/');
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitLeadForm(form())).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(ACTION);
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).body as FormData).get('contact')).toBe(
      '+381641234567',
    );
    expect(assign).toHaveBeenCalledWith('http://localhost:3000/ru/thanks/');
    expect(results).toEqual([true]);
  });

  it('stays on the page with everything typed still there when the server refuses', async () => {
    vi.stubGlobal('fetch', answer(400));
    const element = form();

    await expect(submitLeadForm(element)).resolves.toBe(false);

    expect(assign).not.toHaveBeenCalled();
    expect(
      element.querySelector<HTMLInputElement>('[name="contact"]')!.value,
    ).toBe('+381641234567');
    expect(results).toEqual([false]);
  });

  it('treats a dropped connection as a refusal rather than a browser error page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await expect(submitLeadForm(form())).resolves.toBe(false);

    expect(assign).not.toHaveBeenCalled();
    expect(results).toEqual([false]);
  });

  it('falls back to the posted route when the response carries no final url', async () => {
    vi.stubGlobal('fetch', answer(200));

    await submitLeadForm(form());

    expect(assign).toHaveBeenCalledWith(ACTION);
  });
});

describe('what counts as the server taking the lead', () => {
  it('reads the redirect, not the status of the page it lands on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        redirected: true,
        url: 'http://localhost:3000/ru/thanks/',
      } as Response),
    );

    await expect(submitLeadForm(form())).resolves.toBe(true);
    expect(results).toEqual([true]);
    expect(assign).toHaveBeenCalledWith('http://localhost:3000/ru/thanks/');
  });

  it('refuses a 200 that never redirected, because the route always does', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, redirected: false, url: ACTION }),
    );

    await expect(submitLeadForm(form())).resolves.toBe(false);
    expect(results).toEqual([false]);
    expect(assign).not.toHaveBeenCalled();
  });
});
