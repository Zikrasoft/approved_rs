import { describe, it, expect } from 'vitest';
import { jsonLdText } from './jsonLd.ts';

describe('jsonLdText', () => {
  it('serialises a schema object', () => {
    expect(jsonLdText({ '@type': 'Thing', name: 'X' })).toBe(
      '{"@type":"Thing","name":"X"}',
    );
  });

  it('escapes a closing script tag hidden in a string', () => {
    const text = jsonLdText({ name: '</script><img src=x onerror=alert(1)>' });
    expect(text).not.toContain('</script>');
    expect(text).toContain('\\u003c/script');
  });

  it('escapes every angle bracket, not just the first', () => {
    expect(jsonLdText({ a: '<', b: '<' })).toBe(
      '{"a":"\\u003c","b":"\\u003c"}',
    );
  });

  it('still parses back to the same object', () => {
    const schema = { name: 'a <b> c', nested: { list: ['<x>'] } };
    expect(JSON.parse(jsonLdText(schema))).toEqual(schema);
  });

  it('leaves a schema with no angle brackets untouched', () => {
    expect(jsonLdText({ n: 1 })).toBe('{"n":1}');
  });
});
