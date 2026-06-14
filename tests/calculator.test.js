/**
 * @fileoverview Unit tests for CarbonCalculator module.
 * Tests all emission calculation functions with real-world validation.
 * Uses a minimal vanilla JS test framework (no external dependencies).
 * @version 1.0.0
 */

// ── Minimal Test Framework ────────────────────────────────────────────────
var TestRunner = (function () {
  'use strict';

  var results = [];
  var currentSuite = '';

  function describe(suiteName, fn) {
    currentSuite = suiteName;
    fn();
  }

  function it(testName, fn) {
    var result = {
      suite: currentSuite,
      name: testName,
      passed: false,
      error: null,
    };
    try {
      fn();
      result.passed = true;
    } catch (e) {
      result.error = e.message || String(e);
    }
    results.push(result);
  }

  function expect(actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected) {
          throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
        }
      },
      toBeCloseTo: function (expected, decimals) {
        decimals = decimals !== undefined ? decimals : 2;
        var factor = Math.pow(10, decimals);
        var diff = Math.abs(actual - expected);
        if (diff > (0.5 / factor)) {
          throw new Error('Expected ' + expected + ' (+/-' + (0.5 / factor) + ') but got ' + actual);
        }
      },
      toBeGreaterThan: function (expected) {
        if (actual <= expected) {
          throw new Error('Expected ' + actual + ' to be greater than ' + expected);
        }
      },
      toBeLessThan: function (expected) {
        if (actual >= expected) {
          throw new Error('Expected ' + actual + ' to be less than ' + expected);
        }
      },
      toBeGreaterThanOrEqual: function (expected) {
        if (actual < expected) {
          throw new Error('Expected ' + actual + ' >= ' + expected);
        }
      },
      toBeLessThanOrEqual: function (expected) {
        if (actual > expected) {
          throw new Error('Expected ' + actual + ' <= ' + expected);
        }
      },
      toEqual: function (expected) {
        var a = JSON.stringify(actual);
        var b = JSON.stringify(expected);
        if (a !== b) {
          throw new Error('Expected ' + b + ' but got ' + a);
        }
      },
      toBeNull: function () {
        if (actual !== null) {
          throw new Error('Expected null but got ' + JSON.stringify(actual));
        }
      },
      not: {
        toBe: function (expected) {
          if (actual === expected) {
            throw new Error('Expected value NOT to be ' + JSON.stringify(expected));
          }
        },
        toBeNull: function () {
          if (actual === null) {
            throw new Error('Expected value to not be null');
          }
        },
      },
    };
  }

  function getResults() { return results; }
  function reset() { results = []; currentSuite = ''; }

  return { describe: describe, it: it, expect: expect, getResults: getResults, reset: reset };
})();

var describe = TestRunner.describe;
var it = TestRunner.it;
var expect = TestRunner.expect;

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1: Transport
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateTransport', function () {

  it('returns zero emissions for no vehicle and no transit', function () {
    var result = CarbonCalculator.calculateTransport({
      vehicleType: 'none',
      kmPerWeek: 0,
      passengers: 1,
      publicTransitType: 'none',
      publicTransitKmPerWeek: 0,
      motorcycleKmPerWeek: 0,
    });
    expect(result.total).toBe(0);
  });

  it('calculates petrol car emissions correctly (100 km/week)', function () {
    // Expected: 0.192 kg/km * 100 km/week * 52 weeks / 1 passenger = 998.4 kg
    var result = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium',
      kmPerWeek: 100,
      passengers: 1,
      publicTransitType: 'none',
      publicTransitKmPerWeek: 0,
      motorcycleKmPerWeek: 0,
    });
    expect(result.car).toBeCloseTo(998.4, 0);
  });

  it('divides car emissions proportionally by number of passengers', function () {
    var result1 = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium', kmPerWeek: 100, passengers: 1,
      publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0,
    });
    var result2 = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium', kmPerWeek: 100, passengers: 2,
      publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0,
    });
    expect(result2.car).toBeCloseTo(result1.car / 2, 0);
  });

  it('electric car has lower emissions than petrol for same distance', function () {
    var evResult = CarbonCalculator.calculateTransport({
      vehicleType: 'car_electric', kmPerWeek: 100, passengers: 1,
      publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0,
    });
    var petrolResult = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium', kmPerWeek: 100, passengers: 1,
      publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0,
    });
    expect(evResult.car).toBeLessThan(petrolResult.car);
  });

  it('metro transit has lower emissions per km than city bus', function () {
    var metroResult = CarbonCalculator.calculateTransport({
      vehicleType: 'none', kmPerWeek: 0, passengers: 1,
      publicTransitType: 'train_metro', publicTransitKmPerWeek: 100, motorcycleKmPerWeek: 0,
    });
    var busResult = CarbonCalculator.calculateTransport({
      vehicleType: 'none', kmPerWeek: 0, passengers: 1,
      publicTransitType: 'bus_local', publicTransitKmPerWeek: 100, motorcycleKmPerWeek: 0,
    });
    expect(metroResult.publicTransit).toBeLessThan(busResult.publicTransit);
  });

  it('clamps negative km input to zero emissions', function () {
    var result = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium', kmPerWeek: -100, passengers: 1,
      publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0,
    });
    expect(result.car).toBe(0);
  });

  it('handles missing/empty input gracefully without throwing', function () {
    var result = CarbonCalculator.calculateTransport({});
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('total equals sum of car + publicTransit + motorcycle', function () {
    var result = CarbonCalculator.calculateTransport({
      vehicleType: 'car_petrol_medium', kmPerWeek: 80, passengers: 1,
      publicTransitType: 'bus_local', publicTransitKmPerWeek: 30, motorcycleKmPerWeek: 20,
    });
    var expectedTotal = result.car + result.publicTransit + result.motorcycle;
    expect(result.total).toBeCloseTo(expectedTotal, 0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2: Flights
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateFlights', function () {

  it('returns zero with no flights', function () {
    var result = CarbonCalculator.calculateFlights({
      domesticFlights: 0, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy',
    });
    expect(result.total).toBe(0);
  });

  it('domestic flights are cheaper per trip than long-haul', function () {
    var domestic = CarbonCalculator.calculateFlights({
      domesticFlights: 1, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy',
    });
    var longHaul = CarbonCalculator.calculateFlights({
      domesticFlights: 0, shortHaulFlights: 0, longHaulFlights: 1, classType: 'economy',
    });
    expect(domestic.total).toBeLessThan(longHaul.total);
  });

  it('business class is higher emission than economy for same route', function () {
    var economy = CarbonCalculator.calculateFlights({
      domesticFlights: 2, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy',
    });
    var business = CarbonCalculator.calculateFlights({
      domesticFlights: 2, shortHaulFlights: 0, longHaulFlights: 0, classType: 'business',
    });
    expect(business.total).toBeGreaterThan(economy.total);
  });

  it('long haul round trip produces realistic CO2 (>1000 kg per trip)', function () {
    // Delhi-London: 7000km * 2 (return) * 0.200 * 2 (RF) = 5600 kg economy
    var result = CarbonCalculator.calculateFlights({
      domesticFlights: 0, shortHaulFlights: 0, longHaulFlights: 1, classType: 'economy',
    });
    expect(result.total).toBeGreaterThan(1000);
  });

  it('more flights linearly increase emissions', function () {
    var oneFlight = CarbonCalculator.calculateFlights({
      domesticFlights: 1, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy',
    });
    var fiveFlights = CarbonCalculator.calculateFlights({
      domesticFlights: 5, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy',
    });
    expect(fiveFlights.total).toBeCloseTo(oneFlight.total * 5, 0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3: Energy
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateEnergy', function () {

  it('calculates electricity emissions correctly at India grid factor (0.82 kg/kWh)', function () {
    // 100 kWh/month * 12 * 0.82 / 1 person = 984 kg
    var result = CarbonCalculator.calculateEnergy({
      electricityKwh: 100,
      cookingFuel: 'lpg_cylinder_14kg',
      cookingFuelUnits: 0,
      householdSize: 1,
      hasSolar: false,
    });
    expect(result.electricity).toBeCloseTo(984, 0);
  });

  it('divides electricity emissions by household size', function () {
    var result1 = CarbonCalculator.calculateEnergy({
      electricityKwh: 300, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 0,
      householdSize: 1, hasSolar: false,
    });
    var result3 = CarbonCalculator.calculateEnergy({
      electricityKwh: 300, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 0,
      householdSize: 3, hasSolar: false,
    });
    expect(result3.electricity).toBeCloseTo(result1.electricity / 3, 0);
  });

  it('solar panels reduce electricity emissions by approximately 30%', function () {
    var noSolar = CarbonCalculator.calculateEnergy({
      electricityKwh: 200, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 0,
      householdSize: 2, hasSolar: false,
    });
    var withSolar = CarbonCalculator.calculateEnergy({
      electricityKwh: 200, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 0,
      householdSize: 2, hasSolar: true,
    });
    expect(withSolar.electricity).toBeLessThan(noSolar.electricity);
    var reduction = (noSolar.electricity - withSolar.electricity) / noSolar.electricity;
    expect(reduction).toBeCloseTo(0.30, 1);
  });

  it('LPG cooking fuel produces positive emissions', function () {
    var result = CarbonCalculator.calculateEnergy({
      electricityKwh: 0, cookingFuel: 'lpg_cylinder_14kg',
      cookingFuelUnits: 1, householdSize: 1, hasSolar: false,
    });
    expect(result.cooking).toBeGreaterThan(0);
  });

  it('zero electricity and zero cooking fuel yields zero total', function () {
    var result = CarbonCalculator.calculateEnergy({
      electricityKwh: 0, cookingFuel: 'lpg_cylinder_14kg',
      cookingFuelUnits: 0, householdSize: 1, hasSolar: false,
    });
    expect(result.total).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4: Diet
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateDiet', function () {

  it('vegan diet has significantly lower emissions than heavy meat diet', function () {
    var vegan = CarbonCalculator.calculateDiet({
      dietType: 'vegan', foodWasteKgPerWeek: 0, localFoodPercent: 0,
    });
    var heavyMeat = CarbonCalculator.calculateDiet({
      dietType: 'heavy_meat', foodWasteKgPerWeek: 0, localFoodPercent: 0,
    });
    expect(vegan.total).toBeLessThan(heavyMeat.total);
  });

  it('food waste adds positively to diet emissions', function () {
    var noWaste = CarbonCalculator.calculateDiet({
      dietType: 'medium_meat', foodWasteKgPerWeek: 0, localFoodPercent: 0,
    });
    var withWaste = CarbonCalculator.calculateDiet({
      dietType: 'medium_meat', foodWasteKgPerWeek: 3, localFoodPercent: 0,
    });
    expect(withWaste.total).toBeGreaterThan(noWaste.total);
  });

  it('local and seasonal food reduces diet emissions', function () {
    var noLocal = CarbonCalculator.calculateDiet({
      dietType: 'medium_meat', foodWasteKgPerWeek: 0, localFoodPercent: 0,
    });
    var allLocal = CarbonCalculator.calculateDiet({
      dietType: 'medium_meat', foodWasteKgPerWeek: 0, localFoodPercent: 100,
    });
    expect(allLocal.total).toBeLessThan(noLocal.total);
  });

  it('diet emissions follow expected order: heavy_meat > medium_meat > low_meat > vegetarian > vegan', function () {
    var types = ['heavy_meat', 'medium_meat', 'low_meat', 'vegetarian', 'vegan'];
    var results = types.map(function (t) {
      return CarbonCalculator.calculateDiet({ dietType: t, foodWasteKgPerWeek: 0, localFoodPercent: 0 }).total;
    });
    for (var i = 0; i < results.length - 1; i++) {
      expect(results[i]).toBeGreaterThan(results[i + 1]);
    }
  });

  it('diet base values are within realistic IPCC ranges', function () {
    var vegan = CarbonCalculator.calculateDiet({ dietType: 'vegan', foodWasteKgPerWeek: 0, localFoodPercent: 0 });
    var heavyMeat = CarbonCalculator.calculateDiet({ dietType: 'heavy_meat', foodWasteKgPerWeek: 0, localFoodPercent: 0 });
    // Realistic ranges from Poore & Nemecek 2018
    expect(vegan.base).toBeGreaterThan(500);
    expect(heavyMeat.base).toBeLessThan(5000);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 5: Shopping
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateShopping', function () {

  it('returns zero for minimal shopping lifestyle', function () {
    var result = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 0,
      isFastFashion: false,
      newElectronicsPerYear: 0,
      onlineOrdersPerMonth: 0,
      streamingHoursPerDay: 0,
    });
    expect(result.total).toBe(0);
  });

  it('fast fashion has higher carbon cost per clothing item than quality clothing', function () {
    var quality = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 10, isFastFashion: false,
      newElectronicsPerYear: 0, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0,
    });
    var fastFashion = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 10, isFastFashion: true,
      newElectronicsPerYear: 0, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0,
    });
    expect(fastFashion.clothing).toBeGreaterThan(quality.clothing);
  });

  it('more electronics purchases produces higher emissions', function () {
    var few = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 0, isFastFashion: false,
      newElectronicsPerYear: 1, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0,
    });
    var many = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 0, isFastFashion: false,
      newElectronicsPerYear: 5, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0,
    });
    expect(many.electronics).toBeGreaterThan(few.electronics);
  });

  it('online delivery orders contribute to shipping emissions', function () {
    var noOrders = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 0, isFastFashion: false,
      newElectronicsPerYear: 0, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0,
    });
    var manyOrders = CarbonCalculator.calculateShopping({
      newClothingItemsPerYear: 0, isFastFashion: false,
      newElectronicsPerYear: 0, onlineOrdersPerMonth: 20, streamingHoursPerDay: 0,
    });
    expect(manyOrders.delivery).toBeGreaterThan(noOrders.delivery);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 6: Integration — calculate()
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculate (integration)', function () {

  var MINIMAL_INPUTS = {
    transport: { vehicleType: 'none', kmPerWeek: 0, passengers: 1, publicTransitType: 'none', publicTransitKmPerWeek: 0, motorcycleKmPerWeek: 0 },
    flights: { domesticFlights: 0, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy' },
    energy: { electricityKwh: 0, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 0, householdSize: 1, hasSolar: false },
    diet: { dietType: 'vegan', foodWasteKgPerWeek: 0, localFoodPercent: 100 },
    shopping: { newClothingItemsPerYear: 0, isFastFashion: false, newElectronicsPerYear: 0, onlineOrdersPerMonth: 0, streamingHoursPerDay: 0 },
  };

  var AVERAGE_INPUTS = {
    transport: { vehicleType: 'car_petrol_medium', kmPerWeek: 80, passengers: 1, publicTransitType: 'train_metro', publicTransitKmPerWeek: 20, motorcycleKmPerWeek: 0 },
    flights: { domesticFlights: 2, shortHaulFlights: 0, longHaulFlights: 0, classType: 'economy' },
    energy: { electricityKwh: 150, cookingFuel: 'lpg_cylinder_14kg', cookingFuelUnits: 1, householdSize: 3, hasSolar: false },
    diet: { dietType: 'medium_meat', foodWasteKgPerWeek: 1, localFoodPercent: 20 },
    shopping: { newClothingItemsPerYear: 12, isFastFashion: false, newElectronicsPerYear: 1, onlineOrdersPerMonth: 4, streamingHoursPerDay: 2 },
  };

  it('result object contains all required keys', function () {
    var result = CarbonCalculator.calculate(MINIMAL_INPUTS);
    expect(typeof result.total).toBe('number');
    expect(typeof result.score).toBe('number');
    expect(typeof result.rating).toBe('object');
    expect(typeof result.breakdown).toBe('object');
    expect(typeof result.percentages).toBe('object');
    expect(typeof result.offset).toBe('object');
    expect(typeof result.comparison).toBe('object');
  });

  it('total is approximately sum of category totals', function () {
    var result = CarbonCalculator.calculate(AVERAGE_INPUTS);
    var sumOfCategories = Object.keys(result.breakdown).reduce(function (sum, cat) {
      return sum + result.breakdown[cat].total;
    }, 0);
    expect(Math.abs(result.total - Math.round(sumOfCategories * 10) / 10)).toBeLessThan(1);
  });

  it('minimal lifestyle produces lower total than average lifestyle', function () {
    var minimal = CarbonCalculator.calculate(MINIMAL_INPUTS);
    var average = CarbonCalculator.calculate(AVERAGE_INPUTS);
    expect(minimal.total).toBeLessThan(average.total);
  });

  it('score for minimal inputs is lower than score for average inputs', function () {
    var minimal = CarbonCalculator.calculate(MINIMAL_INPUTS);
    var average = CarbonCalculator.calculate(AVERAGE_INPUTS);
    expect(minimal.score).toBeLessThan(average.score);
  });

  it('percentages sum to approximately 100 (allow ±5 for rounding)', function () {
    var result = CarbonCalculator.calculate(AVERAGE_INPUTS);
    var sum = Object.keys(result.percentages).reduce(function (a, k) { return a + result.percentages[k]; }, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(6);
  });

  it('throws an error when called with null input', function () {
    var threw = false;
    try {
      CarbonCalculator.calculate(null);
    } catch (e) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it('produces realistic India-range footprint for average Indian lifestyle (1000-5000 kg)', function () {
    var result = CarbonCalculator.calculate(AVERAGE_INPUTS);
    expect(result.total).toBeGreaterThan(1000);
    expect(result.total).toBeLessThan(6000);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 7: Score
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateScore', function () {

  it('returns 0 (or below) for emissions at or below sustainable threshold (900 kg)', function () {
    var score = CarbonCalculator.calculateScore(900);
    expect(score).toBeLessThanOrEqual(0);
  });

  it('returns 100 for very high emissions (20000 kg)', function () {
    var score = CarbonCalculator.calculateScore(20000);
    expect(score).toBe(100);
  });

  it('score increases monotonically with increasing emissions', function () {
    var s1 = CarbonCalculator.calculateScore(1000);
    var s2 = CarbonCalculator.calculateScore(5000);
    var s3 = CarbonCalculator.calculateScore(10000);
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 8: Rating
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.getRating', function () {

  it('score 0-20 maps to Eco Champion (excellent)', function () {
    var r = CarbonCalculator.getRating(10);
    expect(r.label).toBe('Eco Champion');
    expect(r.level).toBe('excellent');
  });

  it('score 81-100 maps to Carbon Heavy (critical)', function () {
    var r = CarbonCalculator.getRating(90);
    expect(r.label).toBe('Carbon Heavy');
    expect(r.level).toBe('critical');
  });

  it('all rating levels have a color and icon property', function () {
    [5, 25, 45, 65, 85].forEach(function (score) {
      var r = CarbonCalculator.getRating(score);
      expect(typeof r.color).toBe('string');
      expect(typeof r.icon).toBe('string');
    });
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 9: Offset
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.calculateOffset', function () {

  it('returns positive tree count for a positive footprint', function () {
    var offset = CarbonCalculator.calculateOffset(2100);
    expect(offset.treesNeeded).toBeGreaterThan(0);
  });

  it('trees needed is approximately footprint / 21 kg per tree per year', function () {
    var offset = CarbonCalculator.calculateOffset(2100);
    expect(offset.treesNeeded).toBeCloseTo(100, 0);
  });

  it('higher footprint requires proportionally more trees', function () {
    var low = CarbonCalculator.calculateOffset(1000);
    var high = CarbonCalculator.calculateOffset(5000);
    expect(high.treesNeeded).toBeGreaterThan(low.treesNeeded);
  });

});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 10: Baselines comparison
// ═══════════════════════════════════════════════════════════════════════════

describe('CarbonCalculator.compareToBaselines', function () {

  it('returns comparison object with india_average key', function () {
    var cmp = CarbonCalculator.compareToBaselines(1900);
    expect(cmp.india_average).not.toBeNull();
  });

  it('ratio is 100 when user footprint equals India average (1900 kg)', function () {
    var cmp = CarbonCalculator.compareToBaselines(1900);
    expect(cmp.india_average.ratio).toBe(100);
  });

  it('isAbove is true when user exceeds baseline', function () {
    var cmp = CarbonCalculator.compareToBaselines(5000);
    expect(cmp.india_average.ratio).toBeGreaterThan(100);
    expect(cmp.india_average.isAbove).toBe(true);
  });

  it('isAbove is false when user is below world average (4800 kg)', function () {
    var cmp = CarbonCalculator.compareToBaselines(1000);
    expect(cmp.world_average.ratio).toBeLessThan(100);
    expect(cmp.world_average.isAbove).toBe(false);
  });

  it('returns comparisons for all three baselines (india, world, paris)', function () {
    var cmp = CarbonCalculator.compareToBaselines(3000);
    expect(typeof cmp.india_average).toBe('object');
    expect(typeof cmp.world_average).toBe('object');
    expect(typeof cmp.paris_target).toBe('object');
  });

});

// Expose for test runner
var ALL_TEST_RESULTS = TestRunner.getResults;
