/**
 * @fileoverview Canvas-based chart rendering for Carbon Footprint Platform.
 * Provides ring charts, bar charts, trend lines, and comparison charts.
 * Uses only native Canvas API — no external dependencies.
 * @version 2.0.0
 */

/**
 * @typedef {Object} CanvasContextInfo
 * @property {CanvasRenderingContext2D} ctx - The 2D rendering context.
 * @property {number} width  - CSS width of the canvas (before DPR scaling).
 * @property {number} height - CSS height of the canvas (before DPR scaling).
 */

var CarbonCharts = (function () {
  'use strict';

  // ─── Animation frame constants ───────────────────────────────────────
  /** @constant {number} Number of frames for the score ring animation. */
  const SCORE_RING_FRAMES = 60;
  /** @constant {number} Number of frames for the category bars animation. */
  const CATEGORY_BARS_FRAMES = 50;
  /** @constant {number} Number of frames for the comparison chart animation. */
  const COMPARISON_FRAMES = 55;
  /** @constant {number} Number of frames for the trend line animation. */
  const TREND_LINE_FRAMES = 60;
  /** @constant {number} Number of frames for the donut chart animation. */
  const DONUT_FRAMES = 50;

  // ─── Active animation IDs (one per canvas) ───────────────────────────
  /**
   * Maps canvas element IDs to their active requestAnimationFrame handle
   * so that a new draw call can cancel any in-flight animation first.
   * @type {Object<string, number>}
   */
  const _activeAnimations = {};

  // ─── Shared utilities ────────────────────────────────────────────────

  /**
   * Cubic ease-out function shared by every animated chart.
   * @param {number} t - Normalised progress in the range [0, 1].
   * @returns {number} Eased value in the range [0, 1].
   */
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Generic animation driver that replaces the duplicated
   * animFrame / totalFrames / requestAnimationFrame boilerplate.
   *
   * @param {string}   canvasId    - Canvas element ID (used to track / cancel
   *                                  overlapping animations on the same canvas).
   * @param {function(number): void} drawCallback - Called every frame with a
   *                                  normalised progress value in [0, 1].
   * @param {number}   totalFrames - Total number of frames for the animation.
   */
  function animateChart(canvasId, drawCallback, totalFrames) {
    // Cancel any animation already running on this canvas
    if (_activeAnimations[canvasId]) {
      cancelAnimationFrame(_activeAnimations[canvasId]);
      _activeAnimations[canvasId] = 0;
    }

    let frame = 0;

    /** @private Advances one frame and schedules the next if needed. */
    function step() {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      drawCallback(progress);
      if (frame < totalFrames) {
        _activeAnimations[canvasId] = requestAnimationFrame(step);
      } else {
        _activeAnimations[canvasId] = 0;
      }
    }

    _activeAnimations[canvasId] = requestAnimationFrame(step);
  }

  // ─── Constants ───────────────────────────────────────────────────────

  /** Default chart colors */
  const COLORS = {
    transport: '#22d3ee',
    flights: '#f87171',
    energy: '#fbbf24',
    diet: '#4ade80',
    shopping: '#c084fc',
    neutral: 'rgba(255,255,255,0.15)',
    gridLine: 'rgba(255,255,255,0.07)',
    textPrimary: '#f0fdf4',
    textSecondary: 'rgba(240,253,244,0.6)',
  };

  /**
   * Category display names.
   */
  const CATEGORY_NAMES = {
    transport: 'Transport',
    flights: 'Flights',
    energy: 'Home Energy',
    diet: 'Diet',
    shopping: 'Shopping',
  };

  // ─── Canvas helpers ──────────────────────────────────────────────────

  /**
   * Polyfill for CanvasRenderingContext2D.roundRect (not available in all browsers).
   * Falls back to a manual implementation if native API is missing.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Width.
   * @param {number} h - Height.
   * @param {number|Array} radii - Corner radius or array of radii.
   */
  function roundRectPath(ctx, x, y, w, h, radii) {
    let r;
    if (Array.isArray(radii)) {
      r = radii[0] || 0;
    } else {
      r = radii || 0;
    }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * Draws a rounded rectangle using native or polyfill method.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} x - X position.
   * @param {number} y - Y position.
   * @param {number} w - Width.
   * @param {number} h - Height.
   * @param {number|Array} radii - Corner radius.
   */
  function roundRect(ctx, x, y, w, h, radii) {
    if (w <= 0 || h <= 0) return;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radii);
    } else {
      roundRectPath(ctx, x, y, w, h, radii);
    }
  }

  /**
   * Resolves a canvas ID to a context, with DPR scaling for crisp rendering.
   * @param {string} canvasId - The canvas element ID.
   * @returns {CanvasContextInfo|null}
   */
  function getContext(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Only resize if needed
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    return { ctx: ctx, width: rect.width, height: rect.height };
  }

  // ─── Chart functions ─────────────────────────────────────────────────

  /**
   * Draws an animated ring/donut chart showing overall score.
   * @param {string} canvasId - Canvas element ID.
   * @param {number} score - Score from 0 to 100.
   * @param {Object} rating - Rating object with color.
   * @param {number} [totalKg] - Total kg CO2e for display.
   */
  function drawScoreRing(canvasId, score, rating, totalKg) {
    const c = getContext(canvasId);
    if (!c) return;

    const ctx = c.ctx;
    const W = c.width;
    const H = c.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.38;
    const lineWidth = radius * 0.22;

    // Animate from 0 to target
    const targetAngle = ((score / 100) * Math.PI * 1.5); // 270° sweep max
    const startAngle = Math.PI * 0.75; // Start at bottom-left

    /**
     * Renders one frame of the score ring at the given arc angle.
     * @param {number} angle - Current sweep angle in radians.
     * @param {number} frameProgress - Normalised progress [0, 1].
     */
    function draw(angle, frameProgress) {
      ctx.clearRect(0, 0, W, H);

      // Background ring (track)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + Math.PI * 1.5, false);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (angle > 0) {
        // Score ring
        const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        grad.addColorStop(0, rating.color || '#4ade80');
        grad.addColorStop(1, '#22d3ee');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + angle, false);
        ctx.strokeStyle = grad;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glow effect
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + angle, false);
        ctx.strokeStyle = rating.color || '#4ade80';
        ctx.lineWidth = lineWidth * 0.3;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Center text: total kg
      if (totalKg !== undefined) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let displayKg = Math.round(totalKg * (angle / (Math.PI * 1.5)) * (score > 0 ? 1 : 0));
        if (frameProgress >= 1) displayKg = totalKg;

        ctx.font = 'bold ' + Math.round(radius * 0.38) + 'px Outfit, Inter, sans-serif';
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(Math.round(displayKg).toLocaleString(), cx, cy - radius * 0.12);

        ctx.font = Math.round(radius * 0.16) + 'px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.fillText('kg CO\u2082e / year', cx, cy + radius * 0.14);
      }
    }

    animateChart(canvasId, function (progress) {
      const currentAngle = easeOut(progress) * targetAngle;
      draw(currentAngle, progress);
    }, SCORE_RING_FRAMES);
  }

  /**
   * Draws an animated horizontal bar chart for category breakdown.
   * @param {string} canvasId - Canvas element ID.
   * @param {Object} breakdown - Category breakdown from calculate().
   * @param {number} total - Total kg CO2e.
   */
  function drawCategoryBars(canvasId, breakdown, total) {
    const c = getContext(canvasId);
    if (!c) return;

    const ctx = c.ctx;
    const W = c.width;
    const H = c.height;

    const categories = Object.keys(breakdown);
    const padding = { top: 16, bottom: 16, left: 90, right: 60 };
    const barHeight = Math.min(28, (H - padding.top - padding.bottom) / categories.length - 10);
    const barSpacing = (H - padding.top - padding.bottom) / categories.length;
    const maxVal = Math.max.apply(null, categories.map(function (k) { return breakdown[k].total; }));
    const availWidth = W - padding.left - padding.right;

    /**
     * Renders the category bars at the given animation progress.
     * @param {number} progress - Normalised progress [0, 1].
     */
    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      categories.forEach(function (cat, i) {
        const val = breakdown[cat].total;
        const targetWidth = maxVal > 0 ? (val / maxVal) * availWidth : 0;
        const animWidth = targetWidth * easeOut(progress);
        const y = padding.top + i * barSpacing + (barSpacing - barHeight) / 2;
        const x = padding.left;

        // Category label
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(CATEGORY_NAMES[cat] || cat, x - 8, y + barHeight / 2);

        // Bar background track
        roundRect(ctx, x, y, availWidth, barHeight, barHeight / 2);
        ctx.fillStyle = COLORS.neutral;
        ctx.fill();

        // Bar fill
        if (animWidth > 0) {
          const grad = ctx.createLinearGradient(x, y, x + animWidth, y);
          const color = COLORS[cat] || '#4ade80';
          grad.addColorStop(0, color);
          grad.addColorStop(1, color + 'aa');
          roundRect(ctx, x, y, animWidth, barHeight, barHeight / 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Value label
        if (progress > 0.5) {
          const percent = total > 0 ? Math.round((val / total) * 100) : 0;
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = COLORS.textPrimary;
          ctx.textAlign = 'left';
          ctx.fillText(Math.round(val) + ' kg (' + percent + '%)', x + animWidth + 6, y + barHeight / 2);
        }
      });
    }

    animateChart(canvasId, draw, CATEGORY_BARS_FRAMES);
  }

  /**
   * Draws a comparison bar chart against global baselines.
   * @param {string} canvasId - Canvas element ID.
   * @param {number} userTotal - User's total kg CO2e.
   * @param {Object} baselines - Baseline values.
   */
  function drawComparison(canvasId, userTotal, baselines) {
    const c = getContext(canvasId);
    if (!c) return;

    const ctx = c.ctx;
    const W = c.width;
    const H = c.height;

    const items = [
      { label: 'You', value: userTotal, color: '#4ade80', highlight: true },
      { label: 'India', value: baselines.india_average, color: '#22d3ee', highlight: false },
      { label: 'World', value: baselines.world_average, color: '#fbbf24', highlight: false },
      { label: 'Paris\nTarget', value: baselines.paris_target, color: '#c084fc', highlight: false },
    ];

    const padding = { top: 40, bottom: 50, left: 20, right: 20 };
    const numBars = items.length;
    const barWidth = (W - padding.left - padding.right) / numBars - 12;
    const maxVal = Math.max.apply(null, items.map(function (i) { return i.value; }));
    const availH = H - padding.top - padding.bottom;

    /**
     * Renders the comparison bars at the given animation progress.
     * @param {number} progress - Normalised progress [0, 1].
     */
    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      // Draw title
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.textAlign = 'center';
      ctx.fillText('vs. Global Benchmarks', W / 2, 16);

      items.forEach(function (item, i) {
        const barH = maxVal > 0 ? (item.value / maxVal) * availH : 0;
        const animBarH = barH * easeOut(progress);
        const x = padding.left + i * ((W - padding.left - padding.right) / numBars) + 6;
        const y = H - padding.bottom - animBarH;

        // Highlight glow for user
        if (item.highlight && animBarH > 0) {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 12;
        }

        // Bar
        if (animBarH > 0) {
          const grad = ctx.createLinearGradient(x, y, x, H - padding.bottom);
          grad.addColorStop(0, item.color);
          grad.addColorStop(1, item.color + '44');
          roundRect(ctx, x, y, barWidth, animBarH, [6, 6, 0, 0]);
          ctx.fillStyle = grad;
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Value on top
        if (progress > 0.6) {
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = item.color;
          ctx.textAlign = 'center';
          ctx.fillText(
            (item.value >= 1000 ? (item.value / 1000).toFixed(1) + 't' : item.value + 'kg'),
            x + barWidth / 2,
            Math.max(y - 6, padding.top + 4)
          );
        }

        // Label below
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = item.highlight ? item.color : COLORS.textSecondary;
        ctx.textAlign = 'center';
        const labelLines = item.label.split('\n');
        labelLines.forEach(function (line, li) {
          ctx.fillText(line, x + barWidth / 2, H - padding.bottom + 14 + li * 13);
        });
      });
    }

    animateChart(canvasId, draw, COMPARISON_FRAMES);
  }

  /**
   * Draws a trend line chart from historical calculations.
   * @param {string} canvasId - Canvas element ID.
   * @param {Array} calculations - Array of {date, total} objects.
   */
  function drawTrendLine(canvasId, calculations) {
    const c = getContext(canvasId);
    if (!c || !calculations || calculations.length === 0) return;

    const ctx = c.ctx;
    const W = c.width;
    const H = c.height;

    const padding = { top: 30, bottom: 40, left: 55, right: 20 };
    const availW = W - padding.left - padding.right;
    const availH = H - padding.top - padding.bottom;

    const values = calculations.map(function (calc) { return calc.total; });
    const minVal = Math.min.apply(null, values) * 0.85;
    const maxVal = Math.max.apply(null, values) * 1.1;
    const range = maxVal - minVal || 1;

    function getX(i) {
      return padding.left + (i / Math.max(calculations.length - 1, 1)) * availW;
    }
    function getY(val) {
      return padding.top + availH - ((val - minVal) / range) * availH;
    }

    /**
     * Renders the trend line at the given animation progress.
     * @param {number} progress - Normalised progress [0, 1].
     */
    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      const gridCount = 4;
      for (let gi = 0; gi <= gridCount; gi++) {
        const gy = padding.top + (gi / gridCount) * availH;
        const gVal = Math.round(maxVal - (gi / gridCount) * range);
        ctx.beginPath();
        ctx.moveTo(padding.left, gy);
        ctx.lineTo(W - padding.right, gy);
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.textAlign = 'right';
        ctx.fillText(gVal >= 1000 ? (gVal / 1000).toFixed(1) + 't' : gVal + 'kg', padding.left - 6, gy + 4);
      }

      // Filled area under line
      const visibleCount = Math.max(1, Math.round(calculations.length * progress));
      if (visibleCount > 1) {
        const areaGrad = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
        areaGrad.addColorStop(0, 'rgba(34,211,238,0.25)');
        areaGrad.addColorStop(1, 'rgba(34,211,238,0.02)');

        ctx.beginPath();
        ctx.moveTo(getX(0), H - padding.bottom);
        ctx.lineTo(getX(0), getY(values[0]));
        for (let i = 1; i < visibleCount; i++) {
          ctx.lineTo(getX(i), getY(values[i]));
        }
        ctx.lineTo(getX(visibleCount - 1), H - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(values[0]));
        for (let j = 1; j < visibleCount; j++) {
          ctx.lineTo(getX(j), getY(values[j]));
        }
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Dots and labels
      for (let k = 0; k < visibleCount; k++) {
        const px = getX(k);
        const py = getY(values[k]);

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = '#0d1a0d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Date label
        const date = new Date(calculations[k].date);
        const dateStr = (date.getMonth() + 1) + '/' + date.getDate();
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, px, H - padding.bottom + 16);
      }
    }

    animateChart(canvasId, draw, TREND_LINE_FRAMES);
  }

  /**
   * Draws a donut pie chart for category percentages.
   * @param {string} canvasId - Canvas element ID.
   * @param {Object} percentages - Category percentage map.
   */
  function drawDonut(canvasId, percentages) {
    const c = getContext(canvasId);
    if (!c) return;

    const ctx = c.ctx;
    const W = c.width;
    const H = c.height;
    const cx = W / 2;
    const cy = H / 2;
    const outerR = Math.min(W, H) * 0.42;
    const innerR = outerR * 0.58;

    const categories = Object.keys(percentages).filter(function (k) { return percentages[k] > 0; });
    const total = categories.reduce(function (sum, k) { return sum + percentages[k]; }, 0);
    if (total === 0) return;

    /**
     * Renders the donut chart at the given animation progress.
     * @param {number} progress - Normalised progress [0, 1].
     */
    function draw(progress) {
      ctx.clearRect(0, 0, W, H);
      let currentAngle = -Math.PI / 2;

      categories.forEach(function (cat) {
        const slice = (percentages[cat] / total) * Math.PI * 2 * easeOut(progress);

        // Slice
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, currentAngle, currentAngle + slice, false);
        ctx.closePath();
        ctx.fillStyle = COLORS[cat] || '#ffffff';
        ctx.fill();

        // Inner circle cutout
        currentAngle += slice;
      });

      // Draw inner white circle to make donut
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = '#0d1a0d';
      ctx.fill();

      // Legend below (simple)
      if (progress > 0.8) {
        let legendY = H - 20;
        let legendX = 8;
        categories.forEach(function (cat) {
          roundRect(ctx, legendX, legendY - 8, 10, 10, 2);
          ctx.fillStyle = COLORS[cat] || '#fff';
          ctx.fill();
          ctx.font = '9px Inter, sans-serif';
          ctx.fillStyle = COLORS.textSecondary;
          ctx.textAlign = 'left';
          ctx.fillText((CATEGORY_NAMES[cat] || cat).substring(0, 8), legendX + 13, legendY);
          legendX += 70;
          if (legendX > W - 60) { legendX = 8; legendY -= 16; }
        });
      }
    }

    animateChart(canvasId, draw, DONUT_FRAMES);
  }

  // Public API
  return {
    drawScoreRing: drawScoreRing,
    drawCategoryBars: drawCategoryBars,
    drawComparison: drawComparison,
    drawTrendLine: drawTrendLine,
    drawDonut: drawDonut,
    COLORS: COLORS,
    CATEGORY_NAMES: CATEGORY_NAMES,
  };
})();
