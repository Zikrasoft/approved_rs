import { batteryName, isBattery } from '../part-name';

describe('batteryName', () => {
  it('writes voltage, capacity and cold cranking with А·ч', () => {
    expect(
      batteryName(
        { voltage: 12, capacity: 38, 'cold-cranking': 360 },
        'VARTA',
        '872176000',
      ),
    ).toBe('Аккумулятор 12 В 38 А·ч 360 А VARTA 872176000');
  });

  it('omits missing attributes', () => {
    expect(batteryName({ voltage: 6, capacity: 4 }, 'VARTA', '004014001')).toBe(
      'Аккумулятор 6 В 4 А·ч VARTA 004014001',
    );
    expect(batteryName({}, 'VARTA', '503014004')).toBe(
      'Аккумулятор VARTA 503014004',
    );
  });

  it('keeps decimals and ignores non-numbers', () => {
    expect(batteryName({ capacity: 2.5, voltage: '12' }, 'B', '1')).toBe(
      'Аккумулятор 2.5 А·ч B 1',
    );
  });
});

describe('isBattery', () => {
  it('recognises the battery fields', () => {
    expect(isBattery([{ key: 'cold-cranking' }])).toBe(true);
    expect(isBattery([{ key: 'type' }])).toBe(false);
  });
});
