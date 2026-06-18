/**
 * @fileoverview Unit tests for CarbonStorage module.
 */

describe('CarbonStorage.settings', function () {

  it('loads default settings when empty', function () {
    CarbonStorage.clearAll();
    var s = CarbonStorage.settings();
    expect(s.theme).toBe('dark');
    expect(s.unit).toBe('kg');
    expect(s.country).toBe('IN');
  });

  it('saves and retrieves updated settings', function () {
    CarbonStorage.clearAll();
    var s = CarbonStorage.settings({ theme: 'light', unit: 'lb' });
    expect(s.theme).toBe('light');
    expect(s.unit).toBe('lb');

    var retrieved = CarbonStorage.settings();
    expect(retrieved.theme).toBe('light');
    expect(retrieved.unit).toBe('lb');
  });

});

describe('CarbonStorage.profile', function () {

  it('loads default profile details when empty', function () {
    CarbonStorage.clearAll();
    var p = CarbonStorage.profile();
    expect(p.name).toBe('');
    expect(p.totalCalculations).toBe(0);
  });

  it('saves and retrieves profile updates', function () {
    CarbonStorage.clearAll();
    var p = CarbonStorage.profile({ name: 'Eco Warrior' });
    expect(p.name).toBe('Eco Warrior');

    var retrieved = CarbonStorage.profile();
    expect(retrieved.name).toBe('Eco Warrior');
  });

});

describe('CarbonStorage.calculations', function () {

  it('saves and retrieves calculation records', function () {
    CarbonStorage.clearAll();
    var calc = {
      id: Date.now(),
      date: new Date().toISOString(),
      total: 1520.5,
      breakdown: { transport: 500, energy: 1020.5 },
      timestamp: Date.now()
    };

    CarbonStorage.saveCalculation(calc);
    var list = CarbonStorage.getCalculations();
    expect(list.length).toBe(1);
    expect(list[0].total).toBe(1520.5);
  });

});
