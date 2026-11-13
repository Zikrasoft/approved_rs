import { adminFavicon, withAdminFavicon } from '../admin-favicon';

const ico = Buffer.from('icon');
const icon = `data:image/x-icon;base64,${ico.toString('base64')}`;

describe('admin favicon', () => {
  it('replaces the dashboard placeholder favicon with the CarLab badge', () => {
    const html = withAdminFavicon(
      '<head><link rel="icon" href="data:," data-placeholder-favicon /></head>',
      ico,
    );
    expect(html).toContain(`href="${icon}"`);
    expect(html).not.toContain('data-placeholder-favicon');
    expect(html.match(/rel="icon"/g)).toHaveLength(1);
  });

  it('still adds the badge when the dashboard drops its placeholder', () => {
    expect(withAdminFavicon('<head></head>', ico)).toBe(
      `<head><link rel="icon" href="${icon}" sizes="16x16 32x32 48x48" /></head>`,
    );
  });

  it('reads the committed icon file into the admin page', () => {
    const transform = adminFavicon().transformIndexHtml as (
      html: string,
    ) => string;
    expect(transform('<head></head>')).toMatch(
      /<link rel="icon" href="data:image\/x-icon;base64,AAABAAMA/,
    );
  });
});
