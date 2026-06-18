/**
 * @fileoverview Personalized insights engine for the Carbon Footprint Platform.
 * Generates context-aware, actionable recommendations based on user's emission profile.
 * Uses a rule-based expert system with priority scoring.
 * @version 1.1.0
 */

/**
 * @typedef {Object} InsightDefinition
 * @property {string}   id          - Unique insight identifier.
 * @property {string}   category    - Emission category (transport, flights, energy, diet, shopping).
 * @property {number}   priority    - Priority score (higher = more important).
 * @property {string}   title       - Human-readable insight title.
 * @property {string}   description - Detailed recommendation text.
 * @property {function(Object): number} impact - Returns estimated kg CO2e saved per year.
 * @property {'easy'|'medium'|'hard'} difficulty - Implementation difficulty.
 * @property {string}   icon        - Emoji icon.
 * @property {string[]} tags        - Searchable tags.
 * @property {function(Object): boolean} condition - Predicate that checks applicability.
 */

/**
 * @typedef {Object} EnrichedInsight
 * @property {string}   id            - Unique insight identifier.
 * @property {string}   category      - Emission category.
 * @property {string}   title         - Human-readable insight title.
 * @property {string}   description   - Detailed recommendation text.
 * @property {number}   impactKg      - Estimated kg CO2e saved per year.
 * @property {number}   impactPercent - Percentage of total footprint this represents.
 * @property {'easy'|'medium'|'hard'} difficulty - Implementation difficulty.
 * @property {string}   icon          - Emoji icon.
 * @property {string[]} tags          - Searchable tags.
 * @property {number}   priority      - Priority score.
 */

const CarbonInsights = (function () {
  'use strict';

  // ── Condition thresholds — transport (kg CO2e/year) ─────────────
  const TRANSPORT_EV_MIN = 500;
  const TRANSPORT_CARPOOL_MIN = 300;
  const TRANSPORT_PUBLIC_MIN = 200;
  const TRANSPORT_PUBLIC_MAX_TRANSIT = 100;
  const TRANSPORT_WALK_MIN = 100;
  const TRANSPORT_WFH_MIN = 400;

  // ── Condition thresholds — flights ──────────────────────────────
  const FLIGHTS_LONGHAUL_MIN = 500;
  const FLIGHTS_ECONOMY_MIN = 300;
  const FLIGHTS_OFFSET_MIN = 100;

  // ── Condition thresholds — energy ───────────────────────────────
  const ENERGY_RENEWABLE_MIN = 300;
  const ENERGY_LED_MIN = 200;
  const ENERGY_AC_MIN = 150;
  const ENERGY_COOKING_MIN = 100;

  // ── Condition thresholds — diet ─────────────────────────────────
  const DIET_MEAT_MIN = 2000;
  const DIET_PLANT_MIN = 1800;
  const DIET_LOCAL_MIN = 1000;
  const DIET_WASTE_MIN = 50;

  // ── Condition thresholds — shopping ─────────────────────────────
  const SHOPPING_FASHION_MIN = 100;
  const SHOPPING_ELECTRONICS_MIN = 50;
  const SHOPPING_ONLINE_MIN = 30;

  // ── Defaults ────────────────────────────────────────────────────
  const DEFAULT_MAX_INSIGHTS = 6;
  const EXPANDED_MAX_INSIGHTS = 10;
  const HIGH_IMPACT_COUNT = 3;

  /**
   * Master library of all possible insights/recommendations.
   * Each insight has: id, category, condition function, priority, title, description,
   * impact (kg CO2e saved/year if action taken), difficulty, and tags.
   * @type {InsightDefinition[]}
   */
  const INSIGHT_LIBRARY = [
    // ---- TRANSPORT INSIGHTS ----
    {
      id: 'transport_switch_ev',
      category: 'transport',
      priority: 90,
      title: 'Switch to Electric Vehicle',
      description: 'Your car is your biggest transport emission source. Switching to an EV can cut your car emissions by up to 75% based on India\'s current grid mix.',
      impact: function (r) {
        return Math.round(r.breakdown.transport.car * 0.75);
      },
      difficulty: 'hard',
      icon: '⚡',
      tags: ['transport', 'high-impact'],
      condition: function (r) {
        return r.breakdown.transport.car > TRANSPORT_EV_MIN;
      },
    },
    {
      id: 'transport_carpool',
      category: 'transport',
      priority: 85,
      title: 'Start Carpooling',
      description: 'Sharing your car ride with just one more person can halve your per-trip emissions. Apps like Quick Ride and BlaBlaCar make it easy to find co-riders.',
      impact: function (r) {
        return Math.round(r.breakdown.transport.car * 0.40);
      },
      difficulty: 'easy',
      icon: '🚗',
      tags: ['transport', 'social'],
      condition: function (r) {
        return r.breakdown.transport.car > TRANSPORT_CARPOOL_MIN;
      },
    },
    {
      id: 'transport_switch_public',
      category: 'transport',
      priority: 80,
      title: 'Use Public Transit More',
      description: 'Replacing your car with bus or metro for daily commutes can reduce transport emissions by 60–80%. Most Indian metros now have excellent connectivity.',
      impact: function (r) {
        return Math.round(r.breakdown.transport.car * 0.60);
      },
      difficulty: 'medium',
      icon: '🚌',
      tags: ['transport', 'medium-impact'],
      condition: function (r) {
        return r.breakdown.transport.car > TRANSPORT_PUBLIC_MIN && r.breakdown.transport.publicTransit < TRANSPORT_PUBLIC_MAX_TRANSIT;
      },
    },
    {
      id: 'transport_walk_cycle',
      category: 'transport',
      priority: 70,
      title: 'Walk or Cycle Short Distances',
      description: 'For trips under 5 km, walking or cycling produces zero emissions and improves your health. This is one of the easiest and most rewarding changes you can make.',
      impact: function (r) {
        return Math.round(r.breakdown.transport.car * 0.15);
      },
      difficulty: 'easy',
      icon: '🚴',
      tags: ['transport', 'health'],
      condition: function (r) {
        return r.breakdown.transport.car > TRANSPORT_WALK_MIN;
      },
    },
    {
      id: 'transport_work_from_home',
      category: 'transport',
      priority: 75,
      title: 'Work From Home When Possible',
      description: 'Even one day of remote work per week can reduce commute-related emissions by 20%. Talk to your employer about flexible work arrangements.',
      impact: function (r) {
        return Math.round(r.breakdown.transport.car * 0.20);
      },
      difficulty: 'medium',
      icon: '🏠',
      tags: ['transport', 'work'],
      condition: function (r) {
        return r.breakdown.transport.car > TRANSPORT_WFH_MIN;
      },
    },

    // ---- FLIGHTS INSIGHTS ----
    {
      id: 'flights_reduce_longhaul',
      category: 'flights',
      priority: 95,
      title: 'Reduce Long-Haul Flights',
      description: 'Long-haul flights are among the most carbon-intensive activities. A single round trip from Delhi to London emits ~1,700 kg CO2e. Consider video conferencing for business, and train travel where possible.',
      impact: function (r) {
        return Math.round(r.breakdown.flights.longHaul * 0.50);
      },
      difficulty: 'medium',
      icon: '✈️',
      tags: ['flights', 'high-impact'],
      condition: function (r) {
        return r.breakdown.flights.longHaul > FLIGHTS_LONGHAUL_MIN;
      },
    },
    {
      id: 'flights_economy_class',
      category: 'flights',
      priority: 70,
      title: 'Choose Economy Class',
      description: 'Business class emits 2.2x more per passenger than economy due to seat footprint. Choosing economy on your next international flight can save over 600 kg CO2e per trip.',
      impact: function (r) {
        return Math.round(r.breakdown.flights.total * 0.30);
      },
      difficulty: 'easy',
      icon: '💺',
      tags: ['flights', 'easy-win'],
      condition: function (r) {
        return r.breakdown.flights.total > FLIGHTS_ECONOMY_MIN;
      },
    },
    {
      id: 'flights_carbon_offset',
      category: 'flights',
      priority: 60,
      title: 'Offset Your Flight Emissions',
      description: 'If flying is unavoidable, purchase verified carbon offsets through Gold Standard or Verra-certified projects. It costs approximately ₹400–₹800 per 100 kg CO2e offset.',
      impact: function (r) {
        return r.breakdown.flights.total;
      },
      difficulty: 'easy',
      icon: '🌱',
      tags: ['flights', 'offset'],
      condition: function (r) {
        return r.breakdown.flights.total > FLIGHTS_OFFSET_MIN;
      },
    },

    // ---- ENERGY INSIGHTS ----
    {
      id: 'energy_switch_renewable',
      category: 'energy',
      priority: 90,
      title: 'Switch to Renewable Energy',
      description: 'India\'s grid is becoming greener, but rooftop solar can cut your electricity emissions by up to 90%. With net metering, you can even sell excess power back to the grid.',
      impact: function (r) {
        return Math.round(r.breakdown.energy.electricity * 0.85);
      },
      difficulty: 'hard',
      icon: '☀️',
      tags: ['energy', 'high-impact', 'investment'],
      condition: function (r) {
        return r.breakdown.energy.electricity > ENERGY_RENEWABLE_MIN;
      },
    },
    {
      id: 'energy_led_appliances',
      category: 'energy',
      priority: 75,
      title: 'Upgrade to LED & 5-Star Appliances',
      description: 'LED bulbs use 75% less energy than incandescent. 5-star rated ACs and refrigerators can reduce appliance energy use by 30–50%, saving both CO2 and money.',
      impact: function (r) {
        return Math.round(r.breakdown.energy.electricity * 0.25);
      },
      difficulty: 'medium',
      icon: '💡',
      tags: ['energy', 'cost-saving'],
      condition: function (r) {
        return r.breakdown.energy.electricity > ENERGY_LED_MIN;
      },
    },
    {
      id: 'energy_smart_ac',
      category: 'energy',
      priority: 70,
      title: 'Optimize Air Conditioning Usage',
      description: 'Setting your AC to 24°C instead of 18°C saves 6% energy per degree. Using ceiling fans alongside your AC can allow you to set a higher, comfortable temperature.',
      impact: function (r) {
        return Math.round(r.breakdown.energy.electricity * 0.15);
      },
      difficulty: 'easy',
      icon: '❄️',
      tags: ['energy', 'easy-win'],
      condition: function (r) {
        return r.breakdown.energy.electricity > ENERGY_AC_MIN;
      },
    },
    {
      id: 'energy_induction_cooking',
      category: 'energy',
      priority: 65,
      title: 'Switch to Induction Cooking',
      description: 'Modern induction cooktops powered by renewable electricity produce significantly fewer emissions than LPG. They\'re also safer, faster, and more energy-efficient.',
      impact: function (r) {
        return Math.round(r.breakdown.energy.cooking * 0.60);
      },
      difficulty: 'medium',
      icon: '🍳',
      tags: ['energy', 'cooking'],
      condition: function (r) {
        return r.breakdown.energy.cooking > ENERGY_COOKING_MIN;
      },
    },

    // ---- DIET INSIGHTS ----
    {
      id: 'diet_reduce_meat',
      category: 'diet',
      priority: 90,
      title: 'Reduce Meat Consumption',
      description: 'Beef produces 20x more CO2e than tofu per gram of protein. Going from a meat-heavy to a moderate diet saves ~700 kg CO2e/year. Even one meat-free day per week helps.',
      impact: function (r) {
        return Math.round(r.breakdown.diet.diet * 0.25);
      },
      difficulty: 'medium',
      icon: '🥗',
      tags: ['diet', 'high-impact', 'health'],
      condition: function (r) {
        return r.breakdown.diet.diet > DIET_MEAT_MIN;
      },
    },
    {
      id: 'diet_plant_based',
      category: 'diet',
      priority: 85,
      title: 'Try a Plant-Based Diet',
      description: 'Adopting a fully plant-based diet is one of the single biggest lifestyle changes for the climate — saving up to 1,500 kg CO2e per year compared to an average omnivore diet.',
      impact: function (r) {
        return Math.round(r.breakdown.diet.diet * 0.45);
      },
      difficulty: 'hard',
      icon: '🌿',
      tags: ['diet', 'high-impact'],
      condition: function (r) {
        return r.breakdown.diet.diet > DIET_PLANT_MIN;
      },
    },
    {
      id: 'diet_local_seasonal',
      category: 'diet',
      priority: 60,
      title: 'Buy Local & Seasonal Produce',
      description: 'Locally-grown, seasonal foods travel fewer kilometres from farm to fork. Visiting your local sabzi mandi or farmers\' market can cut food transport emissions by up to 10%.',
      impact: function (r) {
        return Math.round(r.breakdown.diet.diet * 0.08);
      },
      difficulty: 'easy',
      icon: '🥬',
      tags: ['diet', 'easy-win', 'local'],
      condition: function (r) {
        return r.breakdown.diet.diet > DIET_LOCAL_MIN;
      },
    },
    {
      id: 'diet_reduce_waste',
      category: 'diet',
      priority: 75,
      title: 'Cut Food Waste in Half',
      description: 'If food waste were a country, it would be the third-largest emitter. Planning meals, using leftovers creatively, and composting can significantly reduce your food waste footprint.',
      impact: function (r) {
        return Math.round(r.breakdown.diet.foodWaste * 0.50);
      },
      difficulty: 'easy',
      icon: '♻️',
      tags: ['diet', 'waste', 'easy-win'],
      condition: function (r) {
        return r.breakdown.diet.foodWaste > DIET_WASTE_MIN;
      },
    },

    // ---- SHOPPING INSIGHTS ----
    {
      id: 'shopping_slow_fashion',
      category: 'shopping',
      priority: 75,
      title: 'Embrace Slow Fashion',
      description: 'The fashion industry emits more CO2 than aviation and shipping combined. Buying fewer, higher-quality clothes and shopping second-hand can reduce your clothing emissions by 70%.',
      impact: function (r) {
        return Math.round(r.breakdown.shopping.clothing * 0.60);
      },
      difficulty: 'medium',
      icon: '👕',
      tags: ['shopping', 'fashion'],
      condition: function (r) {
        return r.breakdown.shopping.clothing > SHOPPING_FASHION_MIN;
      },
    },
    {
      id: 'shopping_keep_electronics',
      category: 'shopping',
      priority: 70,
      title: 'Keep Electronics Longer',
      description: '80% of a smartphone\'s lifetime emissions come from manufacturing. Keeping your phone for 3 years instead of 2 reduces its annual carbon cost by 33%. Repair before replacing.',
      impact: function (r) {
        return Math.round(r.breakdown.shopping.electronics * 0.33);
      },
      difficulty: 'easy',
      icon: '📱',
      tags: ['shopping', 'electronics'],
      condition: function (r) {
        return r.breakdown.shopping.electronics > SHOPPING_ELECTRONICS_MIN;
      },
    },
    {
      id: 'shopping_reduce_online',
      category: 'shopping',
      priority: 50,
      title: 'Batch Your Online Orders',
      description: 'Consolidating multiple online orders into one reduces delivery vehicle trips. Choosing standard (non-express) delivery can cut delivery emissions by up to 20%.',
      impact: function (r) {
        return Math.round(r.breakdown.shopping.online * 0.20);
      },
      difficulty: 'easy',
      icon: '📦',
      tags: ['shopping', 'easy-win'],
      condition: function (r) {
        return r.breakdown.shopping.online > SHOPPING_ONLINE_MIN;
      },
    },
  ];

  /**
   * Generates a personalized list of insights based on calculation results.
   * @param {Object} calculationResult - Result from CarbonCalculator.calculate().
   * @param {number} [maxInsights=6] - Maximum number of insights to return.
   * @returns {EnrichedInsight[]} Sorted array of applicable insight objects.
   */
  function generateInsights(calculationResult, maxInsights) {
    if (!calculationResult || !calculationResult.breakdown) return [];
    maxInsights = maxInsights || DEFAULT_MAX_INSIGHTS;

    const applicable = INSIGHT_LIBRARY.filter(function (insight) {
      try {
        return insight.condition(calculationResult);
      } catch (_err) {
        return false;
      }
    });

    // Sort by priority (descending), then by potential impact
    applicable.sort(function (a, b) {
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      try {
        return b.impact(calculationResult) - a.impact(calculationResult);
      } catch (_err) {
        return 0;
      }
    });

    // Add computed impact to each insight
    const enriched = applicable.slice(0, maxInsights).map(function (insight) {
      let impactKg = 0;
      try {
        impactKg = insight.impact(calculationResult);
      } catch (_err) {
        impactKg = 0;
      }
      return {
        id: insight.id,
        category: insight.category,
        title: insight.title,
        description: insight.description,
        impactKg: impactKg,
        impactPercent: calculationResult.total > 0
          ? Math.round((impactKg / calculationResult.total) * 100)
          : 0,
        difficulty: insight.difficulty,
        icon: insight.icon,
        tags: insight.tags,
        priority: insight.priority,
      };
    });

    return enriched;
  }

  /**
   * Generates a motivational message based on overall score.
   * @param {Object} rating - Rating object from CarbonCalculator.getRating().
   * @param {number} total - Total kg CO2e.
   * @returns {string} Motivational message.
   */
  function getMotivationalMessage(rating, total) {
    if (!rating || typeof total !== 'number') {
      return 'Track your carbon footprint to get personalized motivation!';
    }

    const messages = {
      excellent: [
        'Outstanding! You are leading the way to a sustainable future. 🌟',
        'Your carbon footprint is genuinely impressive — you\'re in the top tier of eco-conscious individuals!',
        'You\'re living proof that comfortable modern life can be low-carbon. Share your habits!',
      ],
      good: [
        'Great work! You\'re already well below the global average. Keep pushing! 💪',
        'You\'re on the right track. A few more changes and you could be at sustainable levels.',
        'Your commitment to the planet is showing in the numbers. Well done!',
      ],
      moderate: [
        'You\'re at a typical footprint level. Small, consistent changes can make a big difference. 🌱',
        'There is real opportunity here. Focus on your top two emission categories first.',
        'Every action counts. Start with one change this week and build from there.',
      ],
      high: [
        'Your footprint is above average — but awareness is the first step to change! 🔥',
        'The good news: small changes in your top categories can create big savings.',
        'Don\'t be discouraged. Many people start here and dramatically cut their emissions.',
      ],
      critical: [
        'Your footprint is significantly high, but you have enormous potential to reduce it! ⚡',
        'The insights below could help you cut your emissions by over 50%. Start today.',
        'Big footprint = big opportunity to make an impact. Let\'s get to work.',
      ],
    };

    const level = rating.level;
    const pool = messages[level] || messages.moderate;
    const idx = Math.floor(Math.abs(total) % pool.length);
    return pool[idx];
  }

  /**
   * Gets quick wins — easy difficulty insights only.
   * @deprecated Not used by any external module. Will be removed in v2.0.0.
   * @param {Object} calculationResult - Result from CarbonCalculator.calculate().
   * @returns {EnrichedInsight[]} Easy-difficulty insights.
   */
  function getQuickWins(calculationResult) {
    return generateInsights(calculationResult, EXPANDED_MAX_INSIGHTS).filter(function (i) {
      return i.difficulty === 'easy';
    });
  }

  /**
   * Gets high-impact insights (top 3 by impact kg).
   * @deprecated Not used by any external module. Will be removed in v2.0.0.
   * @param {Object} calculationResult - Result from CarbonCalculator.calculate().
   * @returns {EnrichedInsight[]} Top impact insights.
   */
  function getHighImpact(calculationResult) {
    return generateInsights(calculationResult, EXPANDED_MAX_INSIGHTS)
      .sort(function (a, b) { return b.impactKg - a.impactKg; })
      .slice(0, HIGH_IMPACT_COUNT);
  }

  /**
   * Generates a weekly challenge suggestion.
   * @deprecated Not used by any external module. Will be removed in v2.0.0.
   * @param {Object} calculationResult - Result from CarbonCalculator.calculate().
   * @returns {EnrichedInsight|null} A single challenge insight.
   */
  function getWeeklyChallenge(calculationResult) {
    const quickWins = getQuickWins(calculationResult);
    if (quickWins.length > 0) return quickWins[0];
    const allInsights = generateInsights(calculationResult, EXPANDED_MAX_INSIGHTS);
    return allInsights[0] || null;
  }

  // Public API
  return {
    generateInsights: generateInsights,
    getMotivationalMessage: getMotivationalMessage,
    /** @deprecated */ getQuickWins: getQuickWins,
    /** @deprecated */ getHighImpact: getHighImpact,
    /** @deprecated */ getWeeklyChallenge: getWeeklyChallenge,
    INSIGHT_LIBRARY: INSIGHT_LIBRARY,
  };
})();
