/**
 * @fileoverview Carbon footprint calculation engine using real-world emission factors.
 * Data sources: IPCC AR6 (2021), EPA GHG Calculator, UK DEFRA 2023, India MoEFCC.
 * All values are in kg CO2 equivalent (CO2e) unless noted.
 * @version 1.1.0
 */

/**
 * @typedef {Object} CategoryEmissions
 * @property {number} total - Total emissions for this category in kg CO2e.
 */

/**
 * @typedef {Object} TransportEmissions
 * @property {number} total   - Total transport emissions (kg CO2e/yr).
 * @property {number} car     - Car-only emissions (kg CO2e/yr).
 * @property {number} publicTransit - Public transit emissions (kg CO2e/yr).
 * @property {number} motorcycle   - Motorcycle emissions (kg CO2e/yr).
 */

/**
 * @typedef {Object} FlightEmissions
 * @property {number} total     - Total flight emissions (kg CO2e/yr).
 * @property {number} domestic  - Domestic flight emissions (kg CO2e/yr).
 * @property {number} shortHaul - Short-haul international (kg CO2e/yr).
 * @property {number} longHaul  - Long-haul international (kg CO2e/yr).
 */

/**
 * @typedef {Object} EnergyEmissions
 * @property {number} total       - Total energy emissions (kg CO2e/yr).
 * @property {number} electricity - Electricity emissions (kg CO2e/yr).
 * @property {number} cooking     - Cooking fuel emissions (kg CO2e/yr).
 */

/**
 * @typedef {Object} DietEmissions
 * @property {number} total     - Total diet emissions (kg CO2e/yr).
 * @property {number} diet      - Diet-type emissions (kg CO2e/yr).
 * @property {number} foodWaste - Food-waste emissions (kg CO2e/yr).
 */

/**
 * @typedef {Object} ShoppingEmissions
 * @property {number} total       - Total shopping emissions (kg CO2e/yr).
 * @property {number} clothing    - Clothing emissions (kg CO2e/yr).
 * @property {number} electronics - Electronics emissions (kg CO2e/yr).
 * @property {number} online      - Online-order emissions (kg CO2e/yr).
 * @property {number} streaming   - Streaming emissions (kg CO2e/yr).
 */

/**
 * @typedef {Object} RatingInfo
 * @property {string} label - Human-readable rating label.
 * @property {string} level - Machine-readable level key.
 * @property {string} color - Hex colour for UI display.
 * @property {string} icon  - Emoji icon for the rating.
 */

/**
 * @typedef {Object} BaselineComparison
 * @property {number}  value   - Baseline value (kg CO2e/yr).
 * @property {number}  ratio   - User total as a percentage of baseline.
 * @property {boolean} isAbove - Whether user exceeds this baseline.
 * @property {number}  diff    - Absolute difference (kg CO2e).
 */

/**
 * @typedef {Object} OffsetData
 * @property {number} treesNeeded     - Trees required to offset annual emissions.
 * @property {number} solarPanelDays  - Days of avg solar panel output to offset.
 * @property {number} carKmEquivalent - Equivalent car-km (thousands).
 */

/**
 * @typedef {Object} CalculationResult
 * @property {number}  total        - Total annual emissions (kg CO2e).
 * @property {number}  totalTonnes  - Total annual emissions (tonnes CO2e).
 * @property {number}  score        - Score from 0 (best) to 100 (worst).
 * @property {RatingInfo} rating    - Human-readable rating.
 * @property {Object}  breakdown    - Per-category emission objects.
 * @property {TransportEmissions} breakdown.transport
 * @property {FlightEmissions}    breakdown.flights
 * @property {EnergyEmissions}    breakdown.energy
 * @property {DietEmissions}      breakdown.diet
 * @property {ShoppingEmissions}  breakdown.shopping
 * @property {Object.<string, number>} percentages - Category percentages of total.
 * @property {Object.<string, BaselineComparison>} comparison - Baseline comparisons.
 * @property {OffsetData} offset    - Carbon-offset equivalences.
 * @property {string} calculatedAt  - ISO 8601 timestamp of calculation.
 */

var CarbonCalculator = (function () {
  'use strict';

  // ── Module-level numeric constants ──────────────────────────────────────────

  /** Weeks in a calendar year. */
  const WEEKS_PER_YEAR = 52;

  /** Months in a calendar year. */
  const MONTHS_PER_YEAR = 12;

  /** Days in a calendar year. */
  const DAYS_PER_YEAR = 365;

  /** Average km for a domestic one-way flight. */
  const DOMESTIC_AVG_KM = 800;

  /** Average km for a short-haul international one-way flight (1 500–3 700 km). */
  const SHORT_HAUL_AVG_KM = 2000;

  /** Average km for a long-haul international one-way flight (>3 700 km). */
  const LONG_HAUL_AVG_KM = 7000;

  /** Round-trip multiplier (outbound + return). */
  const ROUND_TRIP_MULTIPLIER = 2;

  /** Business-class cabin emission multiplier. */
  const BUSINESS_CLASS_MULTIPLIER = 2.2;

  /** First-class cabin emission multiplier. */
  const FIRST_CLASS_MULTIPLIER = 3.2;

  /** Fraction of electricity offset when solar panels are installed (30 %). */
  const SOLAR_ELECTRICITY_OFFSET_FRACTION = 0.7;

  /** Local-food transport saving as a fraction of base diet emissions. */
  const LOCAL_FOOD_SAVING_FRACTION = 0.10;

  /** kg CO2 absorbed per mature tree per year. */
  const TREE_CO2_ABSORPTION_KG = 21;

  /** kg CO2 offset per day by an average residential solar panel. */
  const SOLAR_PANEL_DAILY_OFFSET_KG = 1.2;

  /** Emission factor for a medium petrol car (kg CO2e/km), used for car-km equivalence. */
  const MEDIUM_PETROL_CAR_FACTOR = 0.192;

  /** Conversion factor from kg to tonnes. */
  const KG_PER_TONNE = 1000;

  /** Rounding precision multiplier (1 decimal place). */
  const ROUND_PRECISION = 10;

  /** Score scale lower bound (sustainable footprint, kg CO2e/yr). */
  const SCORE_MIN_KG = 1000;

  /** Score scale upper bound (very high footprint, kg CO2e/yr). */
  const SCORE_MAX_KG = 15000;

  /** Maximum score value. */
  const SCORE_SCALE = 100;

  // ── Emission factors ────────────────────────────────────────────────────────

  /**
   * Emission factors organized by category.
   * Sources: IPCC AR6, EPA, UK DEFRA 2023, IEA 2022, India MoEFCC.
   * @constant
   */
  const EMISSION_FACTORS = {
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
  const BASELINES = {
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
  const CATEGORY_WEIGHTS = {
    transport: 0.25,
    flights: 0.15,
    energy: 0.25,
    diet: 0.25,
    shopping: 0.10,
  };

  // ── Utility helpers ─────────────────────────────────────────────────────────

  /**
   * Validates that a value is a finite, non-negative number.
   * @param {*} val - Value to validate.
   * @param {number} [defaultVal=0] - Default if invalid.
   * @returns {number} Valid non-negative number.
   */
  function toSafeNumber(val, defaultVal) {
    if (val === null || val === undefined) {
      return (defaultVal !== undefined ? defaultVal : 0);
    }
    const n = parseFloat(val);
    if (typeof n !== 'number' || isNaN(n) || !isFinite(n) || n < 0) {
      return (defaultVal !== undefined ? defaultVal : 0);
    }
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
   * Rounds a number to one decimal place.
   * @param {number} n - Number to round.
   * @returns {number} Rounded value.
   */
  function roundOne(n) {
    return Math.round(n * ROUND_PRECISION) / ROUND_PRECISION;
  }

  // ── Category calculators ────────────────────────────────────────────────────

  /**
   * Calculates annual transport emissions.
   * @param {Object} data - Transport input data.
   * @param {string} data.vehicleType - Type of primary vehicle.
   * @param {number} data.kmPerWeek - Average km driven per week.
   * @param {number} data.passengers - Average passengers in car.
   * @param {string} data.publicTransitType - Type of public transit used.
   * @param {number} data.publicTransitKmPerWeek - km on public transit per week.
   * @param {number} data.motorcycleKmPerWeek - km on motorcycle per week.
   * @returns {TransportEmissions} Transport emissions breakdown.
   */
  function calculateTransport(data) {
    const vehicleType = data.vehicleType || 'none';
    const kmPerWeek = clamp(toSafeNumber(data.kmPerWeek), 0, 5000);
    const passengers = clamp(toSafeNumber(data.passengers, 1), 1, 8);
    const publicTransitType = data.publicTransitType || 'none';
    const publicKmPerWeek = clamp(toSafeNumber(data.publicTransitKmPerWeek), 0, 2000);
    const motoKmPerWeek = clamp(toSafeNumber(data.motorcycleKmPerWeek), 0, 2000);

    const carFactor = EMISSION_FACTORS.transport[vehicleType] || 0;
    const carEmissions = (carFactor * kmPerWeek * WEEKS_PER_YEAR) / Math.max(passengers, 1);

    const transitFactor = EMISSION_FACTORS.transport[publicTransitType] || 0;
    const transitEmissions = transitFactor * publicKmPerWeek * WEEKS_PER_YEAR;

    const motoEmissions = EMISSION_FACTORS.transport.motorcycle * motoKmPerWeek * WEEKS_PER_YEAR;

    const total = carEmissions + transitEmissions + motoEmissions;

    return {
      total: roundOne(total),
      car: roundOne(carEmissions),
      publicTransit: roundOne(transitEmissions),
      motorcycle: roundOne(motoEmissions),
    };
  }

  /**
   * Calculates annual flight emissions.
   * @param {Object} data - Flight input data.
   * @param {number} data.domesticFlights - Number of domestic round trips per year.
   * @param {number} data.shortHaulFlights - Number of short-haul international round trips.
   * @param {number} data.longHaulFlights - Number of long-haul international round trips.
   * @param {string} data.classType - Typical cabin class.
   * @returns {FlightEmissions} Flight emissions breakdown.
   */
  function calculateFlights(data) {
    const domesticFlights = clamp(toSafeNumber(data.domesticFlights), 0, 100);
    const shortHaulFlights = clamp(toSafeNumber(data.shortHaulFlights), 0, 100);
    const longHaulFlights = clamp(toSafeNumber(data.longHaulFlights), 0, 100);
    const classType = data.classType || 'economy';

    let classMultiplier = 1.0;
    if (classType === 'business') classMultiplier = BUSINESS_CLASS_MULTIPLIER;
    if (classType === 'first') classMultiplier = FIRST_CLASS_MULTIPLIER;

    // Round trips (×2 for return)
    const domesticEmissions = domesticFlights * DOMESTIC_AVG_KM * ROUND_TRIP_MULTIPLIER * EMISSION_FACTORS.flights.domestic_economy * classMultiplier;
    const shortHaulEmissions = shortHaulFlights * SHORT_HAUL_AVG_KM * ROUND_TRIP_MULTIPLIER * EMISSION_FACTORS.flights.international_economy_short * classMultiplier;
    const longHaulEmissions = longHaulFlights * LONG_HAUL_AVG_KM * ROUND_TRIP_MULTIPLIER * EMISSION_FACTORS.flights.international_economy_long * classMultiplier;

    const total = domesticEmissions + shortHaulEmissions + longHaulEmissions;

    return {
      total: roundOne(total),
      domestic: roundOne(domesticEmissions),
      shortHaul: roundOne(shortHaulEmissions),
      longHaul: roundOne(longHaulEmissions),
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
   * @returns {EnergyEmissions} Energy emissions breakdown.
   */
  function calculateEnergy(data) {
    const electricityKwh = clamp(toSafeNumber(data.electricityKwh), 0, 10000);
    const cookingFuel = data.cookingFuel || 'lpg_cylinder_14kg';
    const cookingFuelUnits = clamp(toSafeNumber(data.cookingFuelUnits), 0, 100);
    const householdSize = clamp(toSafeNumber(data.householdSize, 3), 1, 20);
    const hasSolar = Boolean(data.hasSolar);

    // Reduce electricity factor if solar is used (assume 30% offset)
    const effectiveElecFactor = hasSolar
      ? EMISSION_FACTORS.energy.electricity_kwh * SOLAR_ELECTRICITY_OFFSET_FRACTION
      : EMISSION_FACTORS.energy.electricity_kwh;

    const electricityEmissions = (electricityKwh * MONTHS_PER_YEAR * effectiveElecFactor) / householdSize;

    const cookingFactor = EMISSION_FACTORS.energy[cookingFuel] || 0;
    const cookingEmissions = (cookingFuelUnits * MONTHS_PER_YEAR * cookingFactor) / householdSize;

    const total = electricityEmissions + cookingEmissions;

    return {
      total: roundOne(total),
      electricity: roundOne(electricityEmissions),
      cooking: roundOne(cookingEmissions),
    };
  }

  /**
   * Calculates annual diet-related emissions.
   * @param {Object} data - Diet input data.
   * @param {string} data.dietType - Diet category key.
   * @param {number} data.foodWasteKgPerWeek - kg of food wasted per week.
   * @param {number} data.localFoodPercent - Percentage of locally-sourced food (0-100).
   * @returns {DietEmissions} Diet emissions breakdown.
   */
  function calculateDiet(data) {
    const dietType = data.dietType || 'medium_meat';
    const foodWasteKgPerWeek = clamp(toSafeNumber(data.foodWasteKgPerWeek), 0, 50);
    const localFoodPercent = clamp(toSafeNumber(data.localFoodPercent, 20), 0, 100);

    const baseDietEmissions = EMISSION_FACTORS.diet[dietType] || EMISSION_FACTORS.diet.medium_meat;

    // Local food reduces transport emissions by ~10% of diet total
    const localFoodSaving = baseDietEmissions * LOCAL_FOOD_SAVING_FRACTION * (localFoodPercent / SCORE_SCALE);
    const adjustedDietEmissions = baseDietEmissions - localFoodSaving;

    const foodWasteEmissions = foodWasteKgPerWeek * WEEKS_PER_YEAR * EMISSION_FACTORS.shopping.food_waste_kg;

    const total = adjustedDietEmissions + foodWasteEmissions;

    return {
      total: roundOne(total),
      diet: roundOne(adjustedDietEmissions),
      foodWaste: roundOne(foodWasteEmissions),
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
   * @returns {ShoppingEmissions} Shopping emissions breakdown.
   */
  function calculateShopping(data) {
    const clothingItems = clamp(toSafeNumber(data.newClothingItemsPerYear), 0, 500);
    const isFastFashion = Boolean(data.isFastFashion);
    const newElectronics = clamp(toSafeNumber(data.newElectronicsPerYear), 0, 20);
    const onlineOrders = clamp(toSafeNumber(data.onlineOrdersPerMonth), 0, 200);
    const streamingHours = clamp(toSafeNumber(data.streamingHoursPerDay), 0, 24);

    const clothingFactor = isFastFashion
      ? EMISSION_FACTORS.shopping.clothing_fast_fashion
      : EMISSION_FACTORS.shopping.clothing_item;
    const clothingEmissions = clothingItems * clothingFactor;

    // Electronics: average device assumed to be phone-equivalent
    const electronicsEmissions = newElectronics * EMISSION_FACTORS.shopping.electronics_phone;

    const onlineEmissions = onlineOrders * MONTHS_PER_YEAR * EMISSION_FACTORS.shopping.online_order;

    const streamingEmissions = streamingHours * DAYS_PER_YEAR * EMISSION_FACTORS.shopping.streaming_hour;

    const total = clothingEmissions + electronicsEmissions + onlineEmissions + streamingEmissions;

    return {
      total: roundOne(total),
      clothing: roundOne(clothingEmissions),
      electronics: roundOne(electronicsEmissions),
      online: roundOne(onlineEmissions),
      streaming: roundOne(streamingEmissions),
    };
  }

  // ── Scoring & comparison ────────────────────────────────────────────────────

  /**
   * Calculates the overall carbon footprint score (0-100, lower = better).
   * @param {number} totalKgCO2e - Total annual CO2e in kg.
   * @returns {number} Score from 0 (best) to 100 (worst).
   */
  function calculateScore(totalKgCO2e) {
    // Score: 0 = sustainable (≤1000 kg), 100 = very high (≥15000 kg)
    const clamped = clamp(totalKgCO2e, SCORE_MIN_KG, SCORE_MAX_KG);
    return Math.round(((clamped - SCORE_MIN_KG) / (SCORE_MAX_KG - SCORE_MIN_KG)) * SCORE_SCALE);
  }

  /**
   * Gets a human-readable rating label based on score.
   * @param {number} score - Score from 0 to 100.
   * @returns {RatingInfo} Rating with label and color key.
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
   * @returns {Object.<string, BaselineComparison>} Comparison object with percentages.
   */
  function compareToBaselines(totalKgCO2e) {
    const result = {};
    Object.keys(BASELINES).forEach(function (key) {
      const baseline = BASELINES[key];
      result[key] = {
        value: baseline,
        ratio: Math.round((totalKgCO2e / baseline) * SCORE_SCALE),
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
   * @returns {OffsetData} Offset data.
   */
  function calculateOffset(totalKgCO2e) {
    const treesNeeded = Math.ceil(totalKgCO2e / TREE_CO2_ABSORPTION_KG);
    const solarPanelDays = Math.ceil(totalKgCO2e / SOLAR_PANEL_DAILY_OFFSET_KG);
    const carKmEquivalent = Math.round((totalKgCO2e / MEDIUM_PETROL_CAR_FACTOR) / KG_PER_TONNE);

    return {
      treesNeeded: treesNeeded,
      solarPanelDays: solarPanelDays,
      carKmEquivalent: carKmEquivalent,
    };
  }

  // ── Main calculation ────────────────────────────────────────────────────────

  /**
   * Main calculation function — runs all category calculations and returns full result.
   * @param {Object} inputs - All user inputs keyed by category.
   * @param {Object} inputs.transport - Transport data.
   * @param {Object} inputs.flights - Flight data.
   * @param {Object} inputs.energy - Energy data.
   * @param {Object} inputs.diet - Diet data.
   * @param {Object} inputs.shopping - Shopping data.
   * @returns {CalculationResult} Complete calculation result.
   * @throws {Error} If inputs is not a non-null object.
   * @throws {TypeError} If inputs is null, undefined, or a non-object type.
   */
  function calculate(inputs) {
    if (inputs === null || inputs === undefined || typeof inputs !== 'object' || Array.isArray(inputs)) {
      throw new TypeError('Invalid inputs: expected a non-null, non-array object');
    }

    const transportResult = calculateTransport(inputs.transport || {});
    const flightsResult = calculateFlights(inputs.flights || {});
    const energyResult = calculateEnergy(inputs.energy || {});
    const dietResult = calculateDiet(inputs.diet || {});
    const shoppingResult = calculateShopping(inputs.shopping || {});

    let total = transportResult.total + flightsResult.total + energyResult.total + dietResult.total + shoppingResult.total;
    total = roundOne(total);

    const score = calculateScore(total);
    const rating = getRating(score);
    const comparison = compareToBaselines(total);
    const offset = calculateOffset(total);

    // Category percentages of total
    const breakdown = {
      transport: transportResult,
      flights: flightsResult,
      energy: energyResult,
      diet: dietResult,
      shopping: shoppingResult,
    };

    const percentages = {};
    Object.keys(breakdown).forEach(function (cat) {
      percentages[cat] = total > 0 ? Math.round((breakdown[cat].total / total) * SCORE_SCALE) : 0;
    });

    return {
      total: total,
      totalTonnes: Math.round((total / KG_PER_TONNE) * SCORE_SCALE) / SCORE_SCALE,
      score: score,
      rating: rating,
      breakdown: breakdown,
      percentages: percentages,
      comparison: comparison,
      offset: offset,
      calculatedAt: new Date().toISOString(),
    };
  }

  // ── Deprecated helpers (kept for backward compatibility) ────────────────────

  /**
   * Gets the largest emission categories (sorted descending).
   * @deprecated Not used by the application. Retained for backward compatibility only.
   * @param {Object} breakdown - Category breakdown from calculate().
   * @returns {Array<{category: string, total: number}>} Sorted categories by emission amount.
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
   * @deprecated Not used by the application. Retained for backward compatibility only.
   * @param {Object} currentInputs - Current user inputs.
   * @param {Object} changes - Proposed input changes.
   * @returns {Object} Savings in kg CO2e and percentage.
   */
  function calculatePotentialSavings(currentInputs, changes) {
    const currentResult = calculate(currentInputs);
    const modifiedInputs = JSON.parse(JSON.stringify(currentInputs));

    Object.keys(changes).forEach(function (category) {
      if (modifiedInputs[category]) {
        Object.assign(modifiedInputs[category], changes[category]);
      }
    });

    const newResult = calculate(modifiedInputs);
    const savingKg = currentResult.total - newResult.total;
    const savingPercent = currentResult.total > 0
      ? Math.round((savingKg / currentResult.total) * SCORE_SCALE)
      : 0;

    return {
      savingKg: roundOne(savingKg),
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
