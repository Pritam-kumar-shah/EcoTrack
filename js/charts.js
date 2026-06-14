/**
 * @fileoverview Canvas-based chart rendering for Carbon Footprint Platform.
 * Provides ring charts, bar charts, trend lines, and comparison charts.
 * Uses only native Canvas API — no external dependencies.
 * @version 1.0.0
 */

var CarbonCharts = (function () {
  'use strict';

  /** Default chart colors */
  var COLORS = {
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
  var CATEGORY_NAMES = {
    transport: 'Transport',
    flights: 'Flights',
    energy: 'Home Energy',
    diet: 'Diet',
    shopping: 'Shopping',
  };

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
    var r;
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
   * @returns {{ctx: CanvasRenderingContext2D, width: number, height: number}|null}
   */
  function getContext(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();

    // Only resize if needed
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    return { ctx: ctx, width: rect.width, height: rect.height };
  }

  /**
   * Draws an animated ring/donut chart showing overall score.
   * @param {string} canvasId - Canvas element ID.
   * @param {number} score - Score from 0 to 100.
   * @param {Object} rating - Rating object with color.
   * @param {number} [totalKg] - Total kg CO2e for display.
   */
  function drawScoreRing(canvasId, score, rating, totalKg) {
    var c = getContext(canvasId);
    if (!c) return;

    var ctx = c.ctx;
    var W = c.width;
    var H = c.height;
    var cx = W / 2;
    var cy = H / 2;
    var radius = Math.min(W, H) * 0.38;
    var lineWidth = radius * 0.22;

    // Animate from 0 to target
    var targetAngle = ((score / 100) * Math.PI * 1.5); // 270° sweep max
    var currentAngle = 0;
    var startAngle = Math.PI * 0.75; // Start at bottom-left
    var animFrames = 60;
    var frame = 0;

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function draw(angle) {
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
        var grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
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

        var displayKg = Math.round(totalKg * (angle / (Math.PI * 1.5)) * (score > 0 ? 1 : 0));
        if (frame >= animFrames) displayKg = totalKg;

        ctx.font = 'bold ' + Math.round(radius * 0.38) + 'px Outfit, Inter, sans-serif';
        ctx.fillStyle = COLORS.textPrimary;
        ctx.fillText(Math.round(displayKg).toLocaleString(), cx, cy - radius * 0.12);

        ctx.font = Math.round(radius * 0.16) + 'px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.fillText('kg CO\u2082e / year', cx, cy + radius * 0.14);
      }
    }

    function animate() {
      frame++;
      var progress = Math.min(frame / animFrames, 1);
      currentAngle = easeOut(progress) * targetAngle;
      draw(currentAngle);
      if (frame < animFrames) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }

  /**
   * Draws an animated horizontal bar chart for category breakdown.
   * @param {string} canvasId - Canvas element ID.
   * @param {Object} breakdown - Category breakdown from calculate().
   * @param {number} total - Total kg CO2e.
   */
  function drawCategoryBars(canvasId, breakdown, total) {
    var c = getContext(canvasId);
    if (!c) return;

    var ctx = c.ctx;
    var W = c.width;
    var H = c.height;

    var categories = Object.keys(breakdown);
    var padding = { top: 16, bottom: 16, left: 90, right: 60 };
    var barHeight = Math.min(28, (H - padding.top - padding.bottom) / categories.length - 10);
    var barSpacing = (H - padding.top - padding.bottom) / categories.length;
    var maxVal = Math.max.apply(null, categories.map(function (k) { return breakdown[k].total; }));
    var availWidth = W - padding.left - padding.right;

    var animFrame = 0;
    var totalFrames = 50;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      categories.forEach(function (cat, i) {
        var val = breakdown[cat].total;
        var targetWidth = maxVal > 0 ? (val / maxVal) * availWidth : 0;
        var animWidth = targetWidth * easeOut(progress);
        var y = padding.top + i * barSpacing + (barSpacing - barHeight) / 2;
        var x = padding.left;

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
          var grad = ctx.createLinearGradient(x, y, x + animWidth, y);
          var color = COLORS[cat] || '#4ade80';
          grad.addColorStop(0, color);
          grad.addColorStop(1, color + 'aa');
          roundRect(ctx, x, y, animWidth, barHeight, barHeight / 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Value label
        if (progress > 0.5) {
          var percent = total > 0 ? Math.round((val / total) * 100) : 0;
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = COLORS.textPrimary;
          ctx.textAlign = 'left';
          ctx.fillText(Math.round(val) + ' kg (' + percent + '%)', x + animWidth + 6, y + barHeight / 2);
        }
      });
    }

    function animate() {
      animFrame++;
      var progress = Math.min(animFrame / totalFrames, 1);
      draw(progress);
      if (animFrame < totalFrames) requestAnimationFrame(animate);
    }

    animate();
  }

  /**
   * Draws a comparison bar chart against global baselines.
   * @param {string} canvasId - Canvas element ID.
   * @param {number} userTotal - User's total kg CO2e.
   * @param {Object} baselines - Baseline values.
   */
  function drawComparison(canvasId, userTotal, baselines) {
    var c = getContext(canvasId);
    if (!c) return;

    var ctx = c.ctx;
    var W = c.width;
    var H = c.height;

    var items = [
      { label: 'You', value: userTotal, color: '#4ade80', highlight: true },
      { label: 'India', value: baselines.india_average, color: '#22d3ee', highlight: false },
      { label: 'World', value: baselines.world_average, color: '#fbbf24', highlight: false },
      { label: 'Paris\nTarget', value: baselines.paris_target, color: '#c084fc', highlight: false },
    ];

    var padding = { top: 40, bottom: 50, left: 20, right: 20 };
    var numBars = items.length;
    var barWidth = (W - padding.left - padding.right) / numBars - 12;
    var maxVal = Math.max.apply(null, items.map(function (i) { return i.value; }));
    var availH = H - padding.top - padding.bottom;

    var animFrame = 0;
    var totalFrames = 55;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      // Draw title
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.textAlign = 'center';
      ctx.fillText('vs. Global Benchmarks', W / 2, 16);

      items.forEach(function (item, i) {
        var barH = maxVal > 0 ? (item.value / maxVal) * availH : 0;
        var animBarH = barH * easeOut(progress);
        var x = padding.left + i * ((W - padding.left - padding.right) / numBars) + 6;
        var y = H - padding.bottom - animBarH;

        // Highlight glow for user
        if (item.highlight && animBarH > 0) {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = 12;
        }

        // Bar
        if (animBarH > 0) {
          var grad = ctx.createLinearGradient(x, y, x, H - padding.bottom);
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
        var labelLines = item.label.split('\n');
        labelLines.forEach(function (line, li) {
          ctx.fillText(line, x + barWidth / 2, H - padding.bottom + 14 + li * 13);
        });
      });
    }

    function animate() {
      animFrame++;
      draw(Math.min(animFrame / totalFrames, 1));
      if (animFrame < totalFrames) requestAnimationFrame(animate);
    }

    animate();
  }

  /**
   * Draws a trend line chart from historical calculations.
   * @param {string} canvasId - Canvas element ID.
   * @param {Array} calculations - Array of {date, total} objects.
   */
  function drawTrendLine(canvasId, calculations) {
    var c = getContext(canvasId);
    if (!c || !calculations || calculations.length === 0) return;

    var ctx = c.ctx;
    var W = c.width;
    var H = c.height;

    var padding = { top: 30, bottom: 40, left: 55, right: 20 };
    var availW = W - padding.left - padding.right;
    var availH = H - padding.top - padding.bottom;

    var values = calculations.map(function (c) { return c.total; });
    var minVal = Math.min.apply(null, values) * 0.85;
    var maxVal = Math.max.apply(null, values) * 1.1;
    var range = maxVal - minVal || 1;

    function getX(i) {
      return padding.left + (i / Math.max(calculations.length - 1, 1)) * availW;
    }
    function getY(val) {
      return padding.top + availH - ((val - minVal) / range) * availH;
    }

    function draw(progress) {
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      var gridCount = 4;
      for (var gi = 0; gi <= gridCount; gi++) {
        var gy = padding.top + (gi / gridCount) * availH;
        var gVal = Math.round(maxVal - (gi / gridCount) * range);
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
      var visibleCount = Math.max(1, Math.round(calculations.length * progress));
      if (visibleCount > 1) {
        var areaGrad = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
        areaGrad.addColorStop(0, 'rgba(34,211,238,0.25)');
        areaGrad.addColorStop(1, 'rgba(34,211,238,0.02)');

        ctx.beginPath();
        ctx.moveTo(getX(0), H - padding.bottom);
        ctx.lineTo(getX(0), getY(values[0]));
        for (var i = 1; i < visibleCount; i++) {
          ctx.lineTo(getX(i), getY(values[i]));
        }
        ctx.lineTo(getX(visibleCount - 1), H - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(getX(0), getY(values[0]));
        for (var j = 1; j < visibleCount; j++) {
          ctx.lineTo(getX(j), getY(values[j]));
        }
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Dots and labels
      for (var k = 0; k < visibleCount; k++) {
        var px = getX(k);
        var py = getY(values[k]);

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.strokeStyle = '#0d1a0d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Date label
        var date = new Date(calculations[k].date);
        var dateStr = (date.getMonth() + 1) + '/' + date.getDate();
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = COLORS.textSecondary;
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, px, H - padding.bottom + 16);
      }
    }

    var animFrame = 0;
    var totalFrames = 60;
    function animate() {
      animFrame++;
      draw(Math.min(animFrame / totalFrames, 1));
      if (animFrame < totalFrames) requestAnimationFrame(animate);
    }
    animate();
  }

  /**
   * Draws a donut pie chart for category percentages.
   * @param {string} canvasId - Canvas element ID.
   * @param {Object} percentages - Category percentage map.
   */
  function drawDonut(canvasId, percentages) {
    var c = getContext(canvasId);
    if (!c) return;

    var ctx = c.ctx;
    var W = c.width;
    var H = c.height;
    var cx = W / 2;
    var cy = H / 2;
    var outerR = Math.min(W, H) * 0.42;
    var innerR = outerR * 0.58;

    var categories = Object.keys(percentages).filter(function (k) { return percentages[k] > 0; });
    var total = categories.reduce(function (sum, k) { return sum + percentages[k]; }, 0);
    if (total === 0) return;

    var animFrame = 0;
    var totalFrames = 50;
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function draw(progress) {
      ctx.clearRect(0, 0, W, H);
      var currentAngle = -Math.PI / 2;

      categories.forEach(function (cat) {
        var slice = (percentages[cat] / total) * Math.PI * 2 * easeOut(progress);

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
        var legendY = H - 20;
        var legendX = 8;
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

    function animate() {
      animFrame++;
      draw(Math.min(animFrame / totalFrames, 1));
      if (animFrame < totalFrames) requestAnimationFrame(animate);
    }
    animate();
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
