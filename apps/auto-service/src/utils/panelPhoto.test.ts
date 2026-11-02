import { describe, expect, it } from 'vitest';
import tall from '@/assets/hero-mechanic.jpg';
import wide from '@/assets/hero-mechanic-wide.jpg';
import { panelPhoto } from './panelPhoto';

describe('panelPhoto', () => {
  it('asks a wide photo for the width its 4:3 desktop inset crops away, not the phone banner', async () => {
    expect((await panelPhoto(wide)).sizes).toBe(
      '(min-width: 1224px) calc(508px * 1.5), (min-width: 1024px) calc(calc(46.5vw - 43px) * 1.5), calc(100vw - 2.5rem)',
    );
  });

  it('asks a portrait photo for its slot width', async () => {
    expect((await panelPhoto(tall)).sizes).toBe(
      '(min-width: 1224px) 508px, (min-width: 1024px) calc(46.5vw - 43px), calc(100vw - 2.5rem)',
    );
  });
});
