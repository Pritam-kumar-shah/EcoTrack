/**
 * @fileoverview Badge and gamification system for Carbon Footprint Platform.
 * Manages achievements, milestones, and reward logic.
 * @version 1.0.0
 */

var CarbonGamification = (function () {
  'use strict';

  /**
   * Complete badge definitions.
   * Each badge: id, name, description, icon, condition, rarity.
   */
  var BADGES = [
    // First steps
    {
      id: 'first_calculation',
      name: 'First Steps',
      description: 'Completed your first carbon footprint calculation.',
      icon: '🌱',
      rarity: 'common',
      category: 'milestone',
      condition: function (state) {
        return state.totalCalculations >= 1;
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
        return state.totalCalculations >= 4;
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
        return state.totalCalculations >= 12;
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
        return state.bestScore !== null && state.bestScore <= 20;
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
        return state.bestScore !== null && state.bestScore <= 40;
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
        return state.lowestFootprint !== null && state.lowestFootprint <= 2500;
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
        return state.lowestFootprint !== null && state.lowestFootprint <= 1900;
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
        return state.lowestFootprint !== null && state.lowestFootprint <= 1000;
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
        return state.reductionPercent >= 10;
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
        return state.reductionPercent >= 25;
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
        return state.reductionPercent >= 50;
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
        return state.totalReductionKg >= 1000;
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
        return state.completedActions >= 1;
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
        return state.completedActions >= 5;
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
        return state.completedActions >= 10;
      },
    },
  ];

  /**
   * Rarity colors for badge display.
   */
  var RARITY_COLORS = {
    common: { bg: 'rgba(134,239,172,0.15)', border: '#4ade80', text: '#4ade80' },
    uncommon: { bg: 'rgba(96,165,250,0.15)', border: '#60a5fa', text: '#60a5fa' },
    rare: { bg: 'rgba(192,132,252,0.15)', border: '#c084fc', text: '#c084fc' },
    legendary: { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fbbf24' },
  };

  /**
   * Builds a state object from stored data for condition evaluation.
   * @param {Object} params - Current app state data.
   * @returns {Object} State for badge conditions.
   */
  function buildBadgeState(params) {
    var calculations = params.calculations || [];
    var actions = params.actions || {};
    var completedActions = Object.values(actions).filter(Boolean).length;

    var totalCalculations = calculations.length;
    var footprints = calculations.map(function (c) { return c.total; });
    var lowestFootprint = footprints.length > 0 ? Math.min.apply(null, footprints) : null;
    var scores = calculations.map(function (c) { return c.score; }).filter(function (s) { return s !== undefined; });
    var bestScore = scores.length > 0 ? Math.min.apply(null, scores) : null;

    var firstFootprint = footprints[0] || null;
    var latestFootprint = footprints[footprints.length - 1] || null;
    var totalReductionKg = (firstFootprint && latestFootprint) ? Math.max(0, firstFootprint - latestFootprint) : 0;
    var reductionPercent = (firstFootprint && firstFootprint > 0)
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
   * @returns {Array} Array of newly earned badge objects.
   */
  function checkBadges(params, alreadyEarned) {
    var state = buildBadgeState(params);
    var newlyEarned = [];

    BADGES.forEach(function (badge) {
      if (alreadyEarned[badge.id]) return; // Already earned
      try {
        if (badge.condition(state)) {
          newlyEarned.push(badge);
        }
      } catch (e) {
        // Silently skip badges with errors
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
      var earnedData = earnedMap[badge.id] || null;
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

    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';

    var particles = [];
    var colors = ['#4ade80', '#22d3ee', '#fbbf24', '#c084fc', '#f87171', '#60a5fa'];
    var PARTICLE_COUNT = 120;

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 100,
        vy: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        opacity: 1,
      });
    }

    var startTime = Date.now();
    var DURATION = 3000; // 3 seconds

    function animate() {
      var elapsed = Date.now() - startTime;
      if (elapsed > DURATION) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var progress = elapsed / DURATION;

      particles.forEach(function (p) {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - progress * 1.5);

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
    var totalBadges = BADGES.length;
    var earnedCount = Object.keys(earnedMap).length;
    var byRarity = { common: 0, uncommon: 0, rare: 0, legendary: 0 };

    BADGES.forEach(function (badge) {
      if (earnedMap[badge.id]) {
        byRarity[badge.rarity]++;
      }
    });

    return {
      earned: earnedCount,
      total: totalBadges,
      percent: Math.round((earnedCount / totalBadges) * 100),
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
