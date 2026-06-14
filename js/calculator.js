/**
 * @fileoverview Carbon footprint calculation engine using real-world emission factors.
 * Data sources: IPCC AR6 (2021), EPA GHG Calculator, UK DEFRA 2023, India MoEFCC.
 * All values are in kg CO2 equivalent (CO2e) unless noted.
 * @version 1.0.0
 */

var CarbonCalculator = (function () {
  'use strict';

  /**
   * Emission factors organized by category.
   * Sources: IPCC AR6, EPA, UK DEFRA 2023, IEA 2022, India MoEFCC.
   * @constant
   */
  var EMISSION_FACTORS = {
    /**
     * Transport: kg CO2e per km
     */
    transport: {
      car_petrol_small: 0.154,    // Petrol car <1.4L
      car_petrol_medium: 0.192,   // Petrol car 1.4–2.0L
      car_petrol_large: 0.282,    // Petrol car >2.0L
      car_diesel_medium: 0.163,   // Diesel car 1.4–2.0L
      car_electric: 0.053,        // EV (India grid avg 0.82 kg/kWh, ~6.5 km/kWh)
      car_hybrid: 0.116,          // Petrol hybrid
      motorcycle: 0.103,          // Average motorcycle
      bus_local: 0.089,           // Local city bus
      train_metro: 0.041,         // Metro/suburban rail
      train_long: 0.035,          // Long-distance train
      auto_rickshaw: 0.085,       // CNG auto-rickshaw
      bicycle: 0,                 // Zero emission
      walking: 0,                 // Zero emission
      cab_shared: 0.077,          // Shared cab/pool
      cab_solo: 0.192,            // Solo cab ride
    },

    /**
     * Flights: kg CO2e per passenger km (including radiative forcing ×2 for high altitude)
     */
    flights: {
      domestic_economy: 0.255,    // <1500km, economy class, RF included
      international_economy_short: 0.195,  // 1500–3700km, RF included
      international_economy_long: 0.200,   // >3700km, RF included
      international_business: 0.430,       // Business class multiplier
      international_first: 0.640,          // First class multiplier
    },

    /**
     * Home energy: kg CO2e per unit
     */
    energy: {
      electricity_kwh: 0.82,       // kg CO2e per kWh (India average grid 2023)
      lpg_cylinder_14kg: 42.6,     // kg CO2e per 14.2kg LPG cylinder
      lpg_kg: 3.0,                 // kg CO2e per kg of LPG
      natural_gas_m3: 2.04,        // kg CO2e per m³ of natural gas
      firewood_kg: 1.9,            // kg CO2e per kg firewood (traditional stove)
      coal_kg: 2.7,                // kg CO2e per kg of coal
      kerosene_litre: 2.54,        // kg CO2e per litre of kerosene
      solar_kwh: 0.048,            // kg CO2e per kWh (lifecycle emissions)
    },

    /**
     * Diet: kg CO2e per year based on diet type
     */
    diet: {
      heavy_meat: 3200,    // High meat consumption (>100g/day)
      medium_meat: 2500,   // Moderate meat (50-100g/day)
      low_meat: 1800,      // Low meat (<50g/day)
      pescatarian: 1500,   // Fish but no meat
      vegetarian: 1200,    // Vegetarian (includes dairy/eggs)
      vegan: 900,          // Fully plant-based
    },

    /**
     * Shopping & lifestyle: kg CO2e per unit/year
     */
    shopping: {
      clothing_item: 12.0,         // Per new clothing item (avg)
      clothing_fast_fashion: 25.0, // Fast fashion item
      electronics_phone: 70.0,     // New smartphone (lifecycle)
      electronics_laptop: 300.0,   // New laptop (lifecycle)
      electronics_tv: 200.0,       // New TV (lifecycle)
      streaming_hour: 0.036,       // Video streaming per hour (cloud+device)
      food_waste_kg: 2.5,          // Per kg of food wasted
      online_order: 0.5,           // Per online shopping delivery
      plastic_bag: 0.033,          // Per single-use plastic bag
      paper_kg: 1.0,               // Per kg of paper consumed
    },

    /**
     * Water: kg CO2e per cubic meter
     */
    water: {
      municipal_m3: 0.344,         // Municipal water supply processing
      hot_water_litre: 0.048,      // Hot water (gas heater avg)
    },
  };

  /**
   * Global reference baselines (annual per-capita, kg CO2e/year).
   * Source: Our World in Data, World Bank 2022.
   */
  var BASELINES = {
    world_average: 4800,
    india_average: 1900,
    usa_average: 14200,
    uk_average: 5500,
    china_average: 8400,
    eu_average: 6400,
    paris_target: 2000,   // IPCC 1.5°C pathway target by 2030
    sustainable: 1000,    // Estimated sustainable per-capita by 2050
  };

  /**
   * Category weights for the overall score calculation.
   */
  var CATEGORY_WEIGHTS = {
    transport: 0.25,
    flights: 0.15,
    energy: 0.25,
    diet: 0.25,
    shopping: 0.10,
  };

  /**
   * Validates that a value is a finite, non-negative number.
   * @param {*} val - Value to validate.
   * @param {number} [defaultVal=0] - Default if invalid.
   * @returns {number} Valid non-negative number.
   */
  function toSafeNumber(val, defaultVal) {
    var n = parseFloat(val);
    if (isNaN(n) || !isFinite(n) || n < 0) return (defaultVal !== undefined ? defaultVal : 0);
    return n;
  }

  /**
   * Clamps a number between min and max.
   * @param {number} n - Number to clamp.
   * @param {number} min - Minimum value.
   * @param {number} max - Maximum value.
   * @returns {number} Clamped number.
   */
  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  /**
   * Calculates annual transport emissions.
   * @param {Object} data - Transport input data.
   * @param {string} data.vehicleType - Type of primary vehicle.
   * @param {number} data.kmPerWeek - Average km driven per week.
   * @param {number} data.passengers - Average passengers in car.
   * @param {string} data.publicTransitType - Type of public transit used.
   * @param {number} data.publicTransitKmPerWeek - km on public transit per week.
   * @param {number} data.motorcycleKmPerWeek - km on motorcycle per week.
   * @returns {Object} Transport emissions breakdown.
   */
  function calculateTransport(data) {
    var vehicleType = data.vehicleType || 'none';
    var kmPerWeek = clamp(toSafeNumber(data.kmPerWeek), 0, 5000);
    var passengers = clamp(toSafeNumber(data.passengers, 1), 1, 8);
    var publicTransitType = data.publicTransitType || 'none';
    var publicKmPerWeek = clamp(toSafeNumber(data.publicTransitKmPerWeek), 0, 2000);
    var motoKmPerWeek = clamp(toSafeNumber(data.motorcycleKmPerWeek), 0, 2000);

    var weeksPerYear = 52;
    var carFactor = EMISSION_FACTORS.transport[vehicleType] || 0;
    var carEmissions = (carFactor * kmPerWeek * weeksPerYear) / Math.max(passengers, 1);

    var transitFactor = EMISSION_FACTORS.transport[publicTransitType] || 0;
    var transitEmissions = transitFactor * publicKmPerWeek * weeksPerYear;

    var motoEmissions = EMISSION_FACTORS.transport.motorcycle * motoKmPerWeek * weeksPerYear;

    var total = carEmissions + transitEmissions + motoEmissions;

    return {
      total: Math.round(total * 10) / 10,
      car: Math.round(carEmissions * 10) / 10,
      publicTransit: Math.round(transitEmissions * 10) / 10,
      motorcycle: Math.round(motoEmissions * 10) / 10,
    };
  }

  /**
   * Calculates annual flight emissions.
   * @param {Object} data - Flight input data.
   * @param {number} data.domesticFlights - Number of domestic round trips per year.
   * @param {number} data.shortHaulFlights - Number of short-haul international round trips.
   * @param {number} data.longHaulFlights - Number of long-haul international round trips.
   * @param {string} data.classType - Typical cabin class.
   * @returns {Object} Flight emissions breakdown.
   */
  function calculateFlights(data) {
    var domesticFlights = clamp(toSafeNumber(data.domesticFlights), 0, 100);
    var shortHaulFlights = clamp(toSafeNumber(data.shortHaulFlights), 0, 100);
    var longHaulFlights = clamp(toSafeNumber(data.longHaulFlights), 0, 100);
    var classType = data.classType || 'economy';

    // Average distances (km, one way):
    var DOMESTIC_AVG_KM = 800;
    var SHORT_HAUL_AVG_KM = 2000;
    var LONG_HAUL_AVG_KM = 7000;

    var classMultiplier = 1.0;
    if (classType === 'business') classMultiplier = 2.2;
    if (classType === 'first') classMultiplier = 3.2;

    // Round trips (×2 for return)
    var domesticEmissions = domesticFlights * DOMESTIC_AVG_KM * 2 * EMISSION_FACTORS.flights.domestic_economy * classMultiplier;
    var shortHaulEmissions = shortHaulFlights * SHORT_HAUL_AVG_KM * 2 * EMISSION_FACTORS.flights.international_economy_short * classMultiplier;
    var longHaulEmissions = longHaulFlights * LONG_HAUL_AVG_KM * 2 * EMISSION_FACTORS.flights.international_economy_long * classMultiplier;

    var total = domesticEmissions + shortHaulEmissions + longHaulEmissions;

    return {
      total: Math.round(total * 10) / 10,
      domestic: Math.round(domesticEmissions * 10) / 10,
      shortHaul: Math.round(shortHaulEmissions * 10) / 10,
      longHaul: Math.round(longHaulEmissions * 10) / 10,
    };
  }

  /**
   * Calculates annual home energy emissions.
   * @param {Object} data - Energy input data.
   * @param {number} data.electricityKwh - Monthly electricity consumption (kWh).
   * @param {string} data.cookingFuel - Primary cooking fuel type.
   * @param {number} data.cookingFuelUnits - Monthly fuel units consumed.
   * @param {number} data.householdSize - Number of people in household.
   * @param {boolean} data.hasSolar - Whether household has solar panels.
   * @returns {Object} Energy emissions breakdown.
   */
  function calculateEnergy(data) {
    var electricityKwh = clamp(toSafeNumber(data.electricityKwh), 0, 10000);
    var cookingFuel = data.cookingFuel || 'lpg_cylinder_14kg';
    var cookingFuelUnits = clamp(toSafeNumber(data.cookingFuelUnits), 0, 100);
    var householdSize = clamp(toSafeNumber(data.householdSize, 3), 1, 20);
    var hasSolar = Boolean(data.hasSolar);

    var monthsPerYear = 12;

    // Reduce electricity factor if solar is used (assume 30% offset)
    var effectiveElecFactor = hasSolar
      ? EMISSION_FACTORS.energy.electricity_kwh * 0.7
      : EMISSION_FACTORS.energy.electricity_kwh;

    var electricityEmissions = (electricityKwh * monthsPerYear * effectiveElecFactor) / householdSize;

    var cookingFactor = EMISSION_FACTORS.energy[cookingFuel] || 0;
    var cookingEmissions = (cookingFuelUnits * monthsPerYear * cookingFactor) / householdSize;

    var total = electricityEmissions + cookingEmissions;

    return {
      total: Math.round(total * 10) / 10,
      electricity: Math.round(electricityEmissions * 10) / 10,
      cooking: Math.round(cookingEmissions * 10) / 10,
    };
  }

  /**
   * Calculates annual diet-related emissions.
   * @param {Object} data - Diet input data.
   * @param {string} data.dietType - Diet category key.
   * @param {number} data.foodWasteKgPerWeek - kg of food wasted per week.
   * @param {number} data.localFoodPercent - Percentage of locally-sourced food (0-100).
   * @returns {Object} Diet emissions breakdown.
   */
  function calculateDiet(data) {
    var dietType = data.dietType || 'medium_meat';
    var foodWasteKgPerWeek = clamp(toSafeNumber(data.foodWasteKgPerWeek), 0, 50);
    var localFoodPercent = clamp(toSafeNumber(data.localFoodPercent, 20), 0, 100);

    var baseDietEmissions = EMISSION_FACTORS.diet[dietType] || EMISSION_FACTORS.diet.medium_meat;

    // Local food reduces transport emissions by ~10% of diet total
    var localFoodSaving = baseDietEmissions * 0.10 * (localFoodPercent / 100);
    var adjustedDietEmissions = baseDietEmissions - localFoodSaving;

    var foodWasteEmissions = foodWasteKgPerWeek * 52 * EMISSION_FACTORS.shopping.food_waste_kg;

    var total = adjustedDietEmissions + foodWasteEmissions;

    return {
      total: Math.round(total * 10) / 10,
      diet: Math.round(adjustedDietEmissions * 10) / 10,
      foodWaste: Math.round(foodWasteEmissions * 10) / 10,
    };
  }

  /**
   * Calculates annual shopping & lifestyle emissions.
   * @param {Object} data - Shopping input data.
   * @param {number} data.newClothingItemsPerYear - New clothing items bought per year.
   * @param {boolean} data.isFastFashion - Whether primarily buys fast fashion.
   * @param {number} data.newElectronicsPerYear - New electronics devices per year.
   * @param {number} data.onlineOrdersPerMonth - Online shopping orders per month.
   * @param {number} data.streamingHoursPerDay - Daily video streaming hours.
   * @returns {Object} Shopping emissions breakdown.
   */
  function calculateShopping(data) {
    var clothingItems = clamp(toSafeNumber(data.newClothingItemsPerYear), 0, 500);
    var isFastFashion = Boolean(data.isFastFashion);
    var newElectronics = clamp(toSafeNumber(data.newElectronicsPerYear), 0, 20);
    var onlineOrders = clamp(toSafeNumber(data.onlineOrdersPerMonth), 0, 200);
    var streamingHours = clamp(toSafeNumber(data.streamingHoursPerDay), 0, 24);

    var clothingFactor = isFastFashion
      ? EMISSION_FACTORS.shopping.clothing_fast_fashion
      : EMISSION_FACTORS.shopping.clothing_item;
    var clothingEmissions = clothingItems * clothingFactor;

    // Electronics: average device assumed to be phone-equivalent
    var electronicsEmissions = newElectronics * EMISSION_FACTORS.shopping.electronics_phone;

    var onlineEmissions = onlineOrders * 12 * EMISSION_FACTORS.shopping.online_order;

    var streamingEmissions = streamingHours * 365 * EMISSION_FACTORS.shopping.streaming_hour;

    var total = clothingEmissions + electronicsEmissions + onlineEmissions + streamingEmissions;

    return {
      total: Math.round(total * 10) / 10,
      clothing: Math.round(clothingEmissions * 10) / 10,
      electronics: Math.round(electronicsEmissions * 10) / 10,
      online: Math.round(onlineEmissions * 10) / 10,
      streaming: Math.round(streamingEmissions * 10) / 10,
    };
  }

  /**
   * Calculates the overall carbon footprint score (0-100, lower = better).
   * @param {number} totalKgCO2e - Total annual CO2e in kg.
   * @returns {number} Score from 0 (best) to 100 (worst).
   */
  function calculateScore(totalKgCO2e) {
    // Score: 0 = sustainable (≤1000 kg), 100 = very high (≥15000 kg)
    var MIN = 1000;
    var MAX = 15000;
    var clamped = clamp(totalKgCO2e, MIN, MAX);
    return Math.round(((clamped - MIN) / (MAX - MIN)) * 100);
  }

  /**
   * Gets a human-readable rating label based on score.
   * @param {number} score - Score from 0 to 100.
   * @returns {Object} Rating with label and color key.
   */
  function getRating(score) {
    if (score <= 20) return { label: 'Eco Champion', level: 'excellent', color: '#4ade80', icon: '🌟' };
    if (score <= 40) return { label: 'Green Warrior', level: 'good', color: '#86efac', icon: '⚔️' };
    if (score <= 60) return { label: 'Conscious Citizen', level: 'moderate', color: '#fbbf24', icon: '🌱' };
    if (score <= 80) return { label: 'High Impact', level: 'high', color: '#fb923c', icon: '🔥' };
    return { label: 'Carbon Heavy', level: 'critical', color: '#f87171', icon: '🚨' };
  }

  /**
   * Compares user footprint against baselines.
   * @param {number} totalKgCO2e - User's total annual CO2e.
   * @returns {Object} Comparison object with percentages.
   */
  function compareToBaselines(totalKgCO2e) {
    var result = {};
    Object.keys(BASELINES).forEach(function (key) {
      var baseline = BASELINES[key];
      result[key] = {
        value: baseline,
        ratio: Math.round((totalKgCO2e / baseline) * 100),
        isAbove: totalKgCO2e > baseline,
        diff: Math.round(Math.abs(totalKgCO2e - baseline)),
      };
    });
    return result;
  }

  /**
   * Calculates how many trees need to be planted to offset footprint.
   * Average mature tree absorbs ~21 kg CO2/year.
   * @param {number} totalKgCO2e - Annual CO2e to offset.
   * @returns {Object} Offset data.
   */
  function calculateOffset(totalKgCO2e) {
    var treesNeeded = Math.ceil(totalKgCO2e / 21);
    var solarPanelDays = Math.ceil(totalKgCO2e / 1.2); // 1.2 kg/day avg solar offset
    var carJourneyEquiv = Math.round((totalKgCO2e / 0.192) / 1000); // km equiv

    return {
      treesNeeded: treesNeeded,
      solarPanelDays: solarPanelDays,
      carKmEquivalent: carJourneyEquiv,
    };
  }

  /**
   * Main calculation function — runs all category calculations and returns full result.
   * @param {Object} inputs - All user inputs keyed by category.
   * @param {Object} inputs.transport - Transport data.
   * @param {Object} inputs.flights - Flight data.
   * @param {Object} inputs.energy - Energy data.
   * @param {Object} inputs.diet - Diet data.
   * @param {Object} inputs.shopping - Shopping data.
   * @returns {Object} Complete calculation result.
   */
  function calculate(inputs) {
    if (!inputs || typeof inputs !== 'object') {
      throw new Error('Invalid inputs: expected an object');
    }

    var transportResult = calculateTransport(inputs.transport || {});
    var flightsResult = calculateFlights(inputs.flights || {});
    var energyResult = calculateEnergy(inputs.energy || {});
    var dietResult = calculateDiet(inputs.diet || {});
    var shoppingResult = calculateShopping(inputs.shopping || {});

    var total = transportResult.total + flightsResult.total + energyResult.total + dietResult.total + shoppingResult.total;
    total = Math.round(total * 10) / 10;

    var score = calculateScore(total);
    var rating = getRating(score);
    var comparison = compareToBaselines(total);
    var offset = calculateOffset(total);

    // Category percentages of total
    var breakdown = {
      transport: transportResult,
      flights: flightsResult,
      energy: energyResult,
      diet: dietResult,
      shopping: shoppingResult,
    };

    var percentages = {};
    Object.keys(breakdown).forEach(function (cat) {
      percentages[cat] = total > 0 ? Math.round((breakdown[cat].total / total) * 100) : 0;
    });

    return {
      total: total,
      totalTonnes: Math.round((total / 1000) * 100) / 100,
      score: score,
      rating: rating,
      breakdown: breakdown,
      percentages: percentages,
      comparison: comparison,
      offset: offset,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Gets the largest emission categories (sorted descending).
   * @param {Object} breakdown - Category breakdown from calculate().
   * @returns {Array} Sorted categories by emission amount.
   */
  function getTopCategories(breakdown) {
    return Object.keys(breakdown)
      .map(function (key) {
        return { category: key, total: breakdown[key].total };
      })
      .sort(function (a, b) { return b.total - a.total; });
  }

  /**
   * Calculates potential savings if user adopts specific changes.
   * @param {Object} currentInputs - Current user inputs.
   * @param {Object} changes - Proposed input changes.
   * @returns {Object} Savings in kg CO2e and percentage.
   */
  function calculatePotentialSavings(currentInputs, changes) {
    var currentResult = calculate(currentInputs);
    var modifiedInputs = JSON.parse(JSON.stringify(currentInputs));

    Object.keys(changes).forEach(function (category) {
      if (modifiedInputs[category]) {
        Object.assign(modifiedInputs[category], changes[category]);
      }
    });

    var newResult = calculate(modifiedInputs);
    var savingKg = currentResult.total - newResult.total;
    var savingPercent = currentResult.total > 0
      ? Math.round((savingKg / currentResult.total) * 100)
      : 0;

    return {
      savingKg: Math.round(savingKg * 10) / 10,
      savingPercent: savingPercent,
      newTotal: newResult.total,
      oldTotal: currentResult.total,
    };
  }

  // Public API
  return {
    calculate: calculate,
    calculateTransport: calculateTransport,
    calculateFlights: calculateFlights,
    calculateEnergy: calculateEnergy,
    calculateDiet: calculateDiet,
    calculateShopping: calculateShopping,
    calculateScore: calculateScore,
    getRating: getRating,
    compareToBaselines: compareToBaselines,
    calculateOffset: calculateOffset,
    calculatePotentialSavings: calculatePotentialSavings,
    getTopCategories: getTopCategories,
    EMISSION_FACTORS: EMISSION_FACTORS,
    BASELINES: BASELINES,
  };
})();
