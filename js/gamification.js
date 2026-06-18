/**
 * @fileoverview Badge and gamification system for Carbon Footprint Platform.
 * Manages achievements, milestones, and reward logic.
 * @version 1.1.0
 */

/**
 * @typedef {Object} RarityColor
 * @property {string} bg     - Background CSS color.
 * @property {string} border - Border CSS color.
 * @property {string} text   - Text CSS color.
 */

/**
 * @typedef {Object} Badge
 * @property {string}   id          - Unique badge identifier.
 * @property {string}   name        - Human-readable badge name.
 * @property {string}   description - What the user did to earn this badge.
 * @property {string}   icon        - Emoji icon for display.
 * @property {'common'|'uncommon'|'rare'|'legendary'} rarity - Badge rarity tier.
 * @property {'milestone'|'achievement'|'reduction'|'action'} category - Badge category.
 * @property {function(BadgeState): boolean} condition - Predicate that checks if badge is earned.
 */

/**
 * @typedef {Object} BadgeState
 * @property {number}      totalCalculations - Number of calculations completed.
 * @property {number|null} lowestFootprint   - Lowest recorded footprint (kg CO2e).
 * @property {number|null} bestScore         - Lowest (best) score achieved.
 * @property {number}      completedActions  - Count of completed eco-actions.
 * @property {number}      totalReductionKg  - Total kg CO2e reduced from first calculation.
 * @property {number}      reductionPercent  - Percentage reduction from first calculation.
 * @property {number|null} firstFootprint    - First recorded footprint.
 * @property {number|null} latestFootprint   - Most recent footprint.
 */

const CarbonGamification = (function () {
  'use strict';

  // ── Score & footprint thresholds ────────────────────────────────
  const ECO_CHAMPION_MAX_SCORE = 20;
  const GREEN_WARRIOR_MAX_SCORE = 40;
  const PARIS_ALIGNED_MAX_KG = 2500;
  const BELOW_INDIA_AVG_MAX_KG = 1900;
  const SUSTAINABLE_HERO_MAX_KG = 1000;

  // ── Reduction thresholds ────────────────────────────────────────
  const REDUCTION_10_PERCENT = 10;
  const REDUCTION_25_PERCENT = 25;
  const REDUCTION_50_PERCENT = 50;
  const REDUCTION_1_TONNE_KG = 1000;

  // ── Milestone thresholds ────────────────────────────────────────
  const MILESTONE_FIRST = 1;
  const MILESTONE_WEEKLY = 4;
  const MILESTONE_DEDICATED = 12;

  // ── Action thresholds ───────────────────────────────────────────
  const ACTION_STARTER_MIN = 1;
  const ACTION_MASTER_MIN = 5;
  const ACTION_CHAMPION_MIN = 10;

  // ── Confetti constants ──────────────────────────────────────────
  const CONFETTI_PARTICLE_COUNT = 120;
  const CONFETTI_DURATION_MS = 3000;
  const CONFETTI_COLORS = ['#4ade80', '#22d3ee', '#fbbf24', '#c084fc', '#f87171', '#60a5fa'];

  /**
   * Complete badge definitions.
   * Each badge: id, name, description, icon, condition, rarity.
   * @type {Badge[]}
   */
  const BADGES = [
    // First steps
    {
      id: 'first_calculation',
      name: 'First Steps',
      description: 'Completed your first carbon footprint calculation.',
      icon: '🌱',
      rarity: 'common',
      category: 'milestone',
      condition: function (state) {
        return state.totalCalculations >= MILESTONE_FIRST;
      },
    },
    {
      id: 'week_warrior',
      name: 'Week Warrior',
      description: 'Calculated your footprint 4 weeks in a row.',
      icon: '📅',
      rarity: 'uncommon',
      category: 'milestone',
      condition: function (state) {
        return state.totalCalculations >= MILESTONE_WEEKLY;
      },
    },
    {
      id: 'dedicated_tracker',
      name: 'Dedicated Tracker',
      description: 'Tracked your footprint 12 times.',
      icon: '🏆',
      rarity: 'rare',
      category: 'milestone',
      condition: function (state) {
        return state.totalCalculations >= MILESTONE_DEDICATED;
      },
    },

    // Score achievements
    {
      id: 'eco_champion',
      name: 'Eco Champion',
      description: 'Achieved an \'Eco Champion\' rating (score ≤ 20).',
      icon: '🌟',
      rarity: 'rare',
      category: 'achievement',
      condition: function (state) {
        return state.bestScore !== null && state.bestScore <= ECO_CHAMPION_MAX_SCORE;
      },
    },
    {
      id: 'green_warrior',
      name: 'Green Warrior',
      description: 'Achieved a \'Green Warrior\' rating.',
      icon: '⚔️',
      rarity: 'uncommon',
      category: 'achievement',
      condition: function (state) {
        return state.bestScore !== null && state.bestScore <= GREEN_WARRIOR_MAX_SCORE;
      },
    },
    {
      id: 'paris_aligned',
      name: 'Paris Aligned',
      description: 'Your footprint is below the 2°C Paris Agreement pathway target.',
      icon: '🇫🇷',
      rarity: 'rare',
      category: 'achievement',
      condition: function (state) {
        return state.lowestFootprint !== null && state.lowestFootprint <= PARIS_ALIGNED_MAX_KG;
      },
    },
    {
      id: 'below_india_avg',
      name: 'Below Average',
      description: 'Your footprint is below India\'s national average.',
      icon: '📉',
      rarity: 'common',
      category: 'achievement',
      condition: function (state) {
        return state.lowestFootprint !== null && state.lowestFootprint <= BELOW_INDIA_AVG_MAX_KG;
      },
    },
    {
      id: 'sustainable_hero',
      name: 'Sustainable Hero',
      description: 'Achieved a footprint below the sustainable threshold of 1000 kg/year.',
      icon: '🦸',
      rarity: 'legendary',
      category: 'achievement',
      condition: function (state) {
        return state.lowestFootprint !== null && state.lowestFootprint <= SUSTAINABLE_HERO_MAX_KG;
      },
    },

    // Reduction achievements
    {
      id: 'first_reduction',
      name: 'Going Down',
      description: 'Reduced your footprint from your first calculation.',
      icon: '⬇️',
      rarity: 'common',
      category: 'reduction',
      condition: function (state) {
        return state.totalReductionKg > 0;
      },
    },
    {
      id: 'cut_10_percent',
      name: '10% Cutter',
      description: 'Reduced your footprint by 10% or more.',
      icon: '✂️',
      rarity: 'uncommon',
      category: 'reduction',
      condition: function (state) {
        return state.reductionPercent >= REDUCTION_10_PERCENT;
      },
    },
    {
      id: 'cut_25_percent',
      name: 'Quarter Cut',
      description: 'Reduced your footprint by 25% — incredible progress!',
      icon: '💪',
      rarity: 'rare',
      category: 'reduction',
      condition: function (state) {
        return state.reductionPercent >= REDUCTION_25_PERCENT;
      },
    },
    {
      id: 'cut_50_percent',
      name: 'Half the Impact',
      description: 'Reduced your footprint by 50%. You are a climate leader.',
      icon: '🌍',
      rarity: 'legendary',
      category: 'reduction',
      condition: function (state) {
        return state.reductionPercent >= REDUCTION_50_PERCENT;
      },
    },
    {
      id: 'saved_1_tonne',
      name: 'Tonne Saver',
      description: 'Saved 1 tonne of CO2e through sustained reductions.',
      icon: '💎',
      rarity: 'rare',
      category: 'reduction',
      condition: function (state) {
        return state.totalReductionKg >= REDUCTION_1_TONNE_KG;
      },
    },

    // Action achievements
    {
      id: 'action_starter',
      name: 'Action Starter',
      description: 'Committed to your first eco-action.',
      icon: '✅',
      rarity: 'common',
      category: 'action',
      condition: function (state) {
        return state.completedActions >= ACTION_STARTER_MIN;
      },
    },
    {
      id: 'action_master',
      name: 'Action Master',
      description: 'Committed to 5 or more eco-actions.',
      icon: '🎯',
      rarity: 'uncommon',
      category: 'action',
      condition: function (state) {
        return state.completedActions >= ACTION_MASTER_MIN;
      },
    },
    {
      id: 'action_champion',
      name: 'Action Champion',
      description: 'Taking on 10+ eco-actions. You are leading by example!',
      icon: '🥇',
      rarity: 'rare',
      category: 'action',
      condition: function (state) {
        return state.completedActions >= ACTION_CHAMPION_MIN;
      },
    },
  ];

  /**
   * Rarity colors for badge display.
   * @type {Object.<string, RarityColor>}
   */
  const RARITY_COLORS = {
    common: { bg: 'rgba(134,239,172,0.15)', border: '#4ade80', text: '#4ade80' },
    uncommon: { bg: 'rgba(96,165,250,0.15)', border: '#60a5fa', text: '#60a5fa' },
    rare: { bg: 'rgba(192,132,252,0.15)', border: '#c084fc', text: '#c084fc' },
    legendary: { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fbbf24' },
  };

  /**
   * Builds a state object from stored data for condition evaluation.
   * @param {Object} params - Current app state data.
   * @returns {BadgeState} State for badge conditions.
   */
  function buildBadgeState(params) {
    if (!params || typeof params !== 'object') {
      return {
        totalCalculations: 0,
        lowestFootprint: null,
        bestScore: null,
        completedActions: 0,
        totalReductionKg: 0,
        reductionPercent: 0,
        firstFootprint: null,
        latestFootprint: null,
      };
    }

    const calculations = params.calculations || [];
    const actions = params.actions || {};
    const completedActions = Object.values(actions).filter(Boolean).length;

    const totalCalculations = calculations.length;
    const footprints = calculations.map(function (c) { return c.total; });
    const lowestFootprint = footprints.length > 0 ? Math.min.apply(null, footprints) : null;
    const scores = calculations.map(function (c) { return c.score; }).filter(function (s) { return s !== undefined; });
    const bestScore = scores.length > 0 ? Math.min.apply(null, scores) : null;

    const firstFootprint = footprints[0] || null;
    const latestFootprint = footprints[footprints.length - 1] || null;
    const totalReductionKg = (firstFootprint && latestFootprint) ? Math.max(0, firstFootprint - latestFootprint) : 0;
    const reductionPercent = (firstFootprint && firstFootprint > 0)
      ? Math.max(0, Math.round(((firstFootprint - latestFootprint) / firstFootprint) * 100))
      : 0;

    return {
      totalCalculations: totalCalculations,
      lowestFootprint: lowestFootprint,
      bestScore: bestScore,
      completedActions: completedActions,
      totalReductionKg: totalReductionKg,
      reductionPercent: reductionPercent,
      firstFootprint: firstFootprint,
      latestFootprint: latestFootprint,
    };
  }

  /**
   * Checks which badges should be newly earned and triggers callbacks.
   * @param {Object} params - Current app state.
   * @param {Object} alreadyEarned - Map of already-earned badge IDs.
   * @returns {Badge[]} Array of newly earned badge objects.
   */
  function checkBadges(params, alreadyEarned) {
    const state = buildBadgeState(params);
    const newlyEarned = [];

    BADGES.forEach(function (badge) {
      if (alreadyEarned[badge.id]) return; // Already earned
      try {
        if (badge.condition(state)) {
          newlyEarned.push(badge);
        }
      } catch (_err) {
        // Silently skip badges with errors in condition evaluation
      }
    });

    return newlyEarned;
  }

  /**
   * Gets all badges with their earned status.
   * @param {Object} earnedMap - Map of earned badge IDs to data.
   * @returns {Array} All badges enriched with earned status.
   */
  function getAllBadges(earnedMap) {
    return BADGES.map(function (badge) {
      const earnedData = earnedMap[badge.id] || null;
      return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        rarity: badge.rarity,
        category: badge.category,
        earned: Boolean(earnedData),
        earnedAt: earnedData ? earnedData.earnedAt : null,
        rarityColors: RARITY_COLORS[badge.rarity] || RARITY_COLORS.common,
      };
    });
  }

  /**
   * Creates confetti animation on the canvas.
   * @param {HTMLCanvasElement} canvas - Canvas element to animate on.
   */
  function launchConfetti(canvas) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';

    const particles = [];

    for (let i = 0; i < CONFETTI_PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 100,
        vy: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
        opacity: 1,
      });
    }

    const startTime = Date.now();
    const OPACITY_FADE_FACTOR = 1.5;

    function animate() {
      const elapsed = Date.now() - startTime;
      if (elapsed > CONFETTI_DURATION_MS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const progress = elapsed / CONFETTI_DURATION_MS;

      particles.forEach(function (p) {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - progress * OPACITY_FADE_FACTOR);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  /**
   * Gets earned badge count and progress stats.
   * @param {Object} earnedMap - Map of earned badge IDs.
   * @returns {Object} Progress statistics.
   */
  function getProgress(earnedMap) {
    const totalBadges = BADGES.length;
    const earnedCount = Object.keys(earnedMap).length;
    const byRarity = { common: 0, uncommon: 0, rare: 0, legendary: 0 };

    BADGES.forEach(function (badge) {
      if (earnedMap[badge.id]) {
        byRarity[badge.rarity]++;
      }
    });

    return {
      earned: earnedCount,
      total: totalBadges,
      percent: totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0,
      byRarity: byRarity,
    };
  }

  // Public API
  return {
    BADGES: BADGES,
    RARITY_COLORS: RARITY_COLORS,
    checkBadges: checkBadges,
    getAllBadges: getAllBadges,
    getProgress: getProgress,
    launchConfetti: launchConfetti,
  };
})();
