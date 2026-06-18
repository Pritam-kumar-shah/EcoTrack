/**
 * @fileoverview Unit tests for CarbonGamification module.
 */

describe('CarbonGamification.getAllBadges', function () {

  it('returns an array of all defined badges', function () {
    var list = CarbonGamification.getAllBadges({});
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);

    var first = list[0];
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');
    expect(typeof first.description).toBe('string');
    expect(typeof first.icon).toBe('string');
  });

});

describe('CarbonGamification.getProgress', function () {

  it('calculates completion statistics when no badges are earned', function () {
    var stats = CarbonGamification.getProgress({});
    expect(stats.earned).toBe(0);
    expect(stats.percent).toBe(0);
  });

  it('calculates completion statistics when some badges are earned', function () {
    var earned = {
      'first_calculation': { earnedAt: new Date().toISOString() },
      'action_starter': { earnedAt: new Date().toISOString() }
    };
    var stats = CarbonGamification.getProgress(earned);
    expect(stats.earned).toBe(2);
    expect(stats.percent).toBeGreaterThan(0);
  });

});

describe('CarbonGamification.checkBadges', function () {

  it('unlocks first_calculation badge when a calculation is recorded', function () {
    var params = {
      calculations: [{ total: 3000, score: 50 }],
      actions: {}
    };
    var alreadyEarned = {};
    var newlyEarned = CarbonGamification.checkBadges(params, alreadyEarned);
    var ids = newlyEarned.map(function (b) { return b.id; });

    expect(ids.indexOf('first_calculation')).not.toBe(-1);
  });

});
