declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
    static fragment(html: string): DocumentFragment;
  }
}
