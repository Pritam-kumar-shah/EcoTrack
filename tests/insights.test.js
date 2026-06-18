/**
 * @fileoverview Unit tests for CarbonInsights module.
 */

describe('CarbonInsights.getMotivationalMessage', function () {

  it('returns a motivational string message', function () {
    var msg = CarbonInsights.getMotivationalMessage(50);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

});

describe('CarbonInsights.generateInsights', function () {

  it('generates insights based on carbon footprint result', function () {
    // Mock calculationResult
    var calculationResult = {
      total: 5000,
      breakdown: {
        transport: { total: 2000, car: 1800, publicTransit: 200, motorcycle: 0 },
        flights: { total: 1000, domestic: 500, shortHaul: 500, longHaul: 0 },
        energy: { total: 1000, electricity: 800, cooking: 200 },
        diet: { total: 600, diet: 500, foodWaste: 100 },
        shopping: { total: 400, clothing: 200, electronics: 200 }
      }
    };

    var insights = CarbonInsights.generateInsights(calculationResult);
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);

    // Check structure of first insight
    var first = insights[0];
    expect(typeof first.id).toBe('string');
    expect(typeof first.category).toBe('string');
    expect(typeof first.title).toBe('string');
    expect(typeof first.impactKg).toBe('number');
  });

});
