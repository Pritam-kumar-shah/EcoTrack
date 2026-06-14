/**
 * @fileoverview Main application controller for Carbon Footprint Awareness Platform.
 * Manages routing, UI state, form handling, and orchestrates all modules.
 * @version 1.0.0
 */

var CarbonApp = (function () {
  'use strict';

  // ─── App State ────────────────────────────────────────────────────────────
  var state = {
    currentPage: 'home',
    currentStep: 1,
    totalSteps: 5,
    lastResult: null,
    formData: {
      transport: {},
      flights: {},
      energy: {},
      diet: {},
      shopping: {},
    },
    isCalculating: false,
  };

  // Eco-actions library
  var ECO_ACTIONS = [
    {
      id: 'act_ev',
      category: 'transport',
      title: 'Switch to Electric Vehicle or EV Two-Wheeler',
      savingKg: 800,
      icon: '⚡',
      difficulty: 'hard',
    },
    {
      id: 'act_carpool',
      category: 'transport',
      title: 'Carpool to work at least 3 days/week',
      savingKg: 400,
      icon: '🚗',
      difficulty: 'medium',
    },
    {
      id: 'act_public_transit',
      category: 'transport',
      title: 'Use public transport for daily commute',
      savingKg: 600,
      icon: '🚌',
      difficulty: 'medium',
    },
    {
      id: 'act_cycle',
      category: 'transport',
      title: 'Cycle or walk for trips under 3 km',
      savingKg: 150,
      icon: '🚴',
      difficulty: 'easy',
    },
    {
      id: 'act_wfh',
      category: 'transport',
      title: 'Work from home 2+ days per week',
      savingKg: 300,
      icon: '🏠',
      difficulty: 'medium',
    },
    {
      id: 'act_no_flight',
      category: 'flights',
      title: 'Skip one long-haul flight this year',
      savingKg: 1700,
      icon: '✈️',
      difficulty: 'hard',
    },
    {
      id: 'act_economy',
      category: 'flights',
      title: 'Always fly economy class',
      savingKg: 500,
      icon: '💺',
      difficulty: 'easy',
    },
    {
      id: 'act_solar',
      category: 'energy',
      title: 'Install rooftop solar panels',
      savingKg: 900,
      icon: '☀️',
      difficulty: 'hard',
    },
    {
      id: 'act_led',
      category: 'energy',
      title: 'Switch all bulbs to LED',
      savingKg: 80,
      icon: '💡',
      difficulty: 'easy',
    },
    {
      id: 'act_ac_24',
      category: 'energy',
      title: 'Set AC to 24°C instead of lower',
      savingKg: 90,
      icon: '❄️',
      difficulty: 'easy',
    },
    {
      id: 'act_5star',
      category: 'energy',
      title: 'Upgrade to 5-star rated appliances',
      savingKg: 200,
      icon: '⭐',
      difficulty: 'medium',
    },
    {
      id: 'act_meatfree',
      category: 'diet',
      title: 'Go meat-free one day per week',
      savingKg: 120,
      icon: '🥗',
      difficulty: 'easy',
    },
    {
      id: 'act_vegetarian',
      category: 'diet',
      title: 'Adopt a vegetarian diet',
      savingKg: 600,
      icon: '🌿',
      difficulty: 'hard',
    },
    {
      id: 'act_local_food',
      category: 'diet',
      title: 'Buy local/seasonal produce from markets',
      savingKg: 100,
      icon: '🥬',
      difficulty: 'easy',
    },
    {
      id: 'act_less_waste',
      category: 'diet',
      title: 'Plan meals to halve food waste',
      savingKg: 130,
      icon: '♻️',
      difficulty: 'easy',
    },
    {
      id: 'act_slow_fashion',
      category: 'shopping',
      title: 'Buy no new fast-fashion items this year',
      savingKg: 200,
      icon: '👕',
      difficulty: 'medium',
    },
    {
      id: 'act_secondhand',
      category: 'shopping',
      title: 'Buy second-hand clothing & electronics',
      savingKg: 150,
      icon: '🔄',
      difficulty: 'easy',
    },
    {
      id: 'act_repair',
      category: 'shopping',
      title: 'Repair electronics instead of replacing',
      savingKg: 100,
      icon: '🔧',
      difficulty: 'easy',
    },
    {
      id: 'act_batch_orders',
      category: 'shopping',
      title: 'Batch online orders (fewer deliveries)',
      savingKg: 40,
      icon: '📦',
      difficulty: 'easy',
    },
  ];

  // ─── DOM Helpers ──────────────────────────────────────────────────────────
  /**
   * Gets an element by ID safely.
   * @param {string} id - Element ID.
   * @returns {HTMLElement|null}
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Sets inner text content (safe, no HTML injection).
   * @param {string} id - Element ID.
   * @param {string} text - Text to set.
   */
  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = String(text);
  }

  /**
   * Sets display style.
   * @param {string} id - Element ID.
   * @param {string} display - CSS display value.
   */
  function setDisplay(id, display) {
    var el = $(id);
    if (el) el.style.display = display;
  }

  // ─── Navigation / Routing ────────────────────────────────────────────────
  /**
   * Navigates to a page by ID.
   * @param {string} pageName - Page to navigate to.
   */
  function navigateTo(pageName) {
    var pages = document.querySelectorAll('.page-section');
    pages.forEach(function (p) {
      p.classList.remove('page-active');
      p.setAttribute('aria-hidden', 'true');
    });

    var target = $('page-' + pageName);
    if (target) {
      target.classList.add('page-active');
      target.setAttribute('aria-hidden', 'false');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update nav tabs
    var navBtns = document.querySelectorAll('.nav-tab');
    navBtns.forEach(function (btn) {
      btn.classList.toggle('nav-tab-active', btn.dataset.page === pageName);
      btn.setAttribute('aria-current', btn.dataset.page === pageName ? 'page' : 'false');
    });

    state.currentPage = pageName;

    // Trigger page-specific init
    if (pageName === 'dashboard' && state.lastResult) {
      renderDashboard(state.lastResult);
    }
    if (pageName === 'progress') {
      renderProgress();
    }
    if (pageName === 'badges') {
      renderBadges();
    }
    if (pageName === 'actions') {
      renderActions();
    }
  }

  // ─── Calculator Wizard ────────────────────────────────────────────────────
  /**
   * Updates the step progress indicator.
   */
  function updateStepIndicator() {
    var step = state.currentStep;
    var total = state.totalSteps;

    // Update progress bar
    var bar = $('calc-progress-bar');
    if (bar) bar.style.width = ((step / total) * 100) + '%';

    // Update step number text
    setText('step-current', step);
    setText('step-total', total);

    // Update step indicator dots
    var dots = document.querySelectorAll('.step-dot');
    dots.forEach(function (dot, i) {
      dot.classList.toggle('step-dot-active', i < step);
      dot.classList.toggle('step-dot-current', i === step - 1);
      dot.setAttribute('aria-label', 'Step ' + (i + 1) + (i < step ? ' complete' : ''));
    });

    // Show/hide step panels
    for (var s = 1; s <= total; s++) {
      var panel = $('step-panel-' + s);
      if (panel) {
        panel.classList.toggle('step-panel-active', s === step);
        panel.setAttribute('aria-hidden', s !== step ? 'true' : 'false');
      }
    }

    // Prev/Next buttons
    var prevBtn = $('btn-prev');
    var nextBtn = $('btn-next');
    var calcBtn = $('btn-calculate');

    if (prevBtn) prevBtn.disabled = step === 1;
    if (nextBtn) nextBtn.style.display = step < total ? 'inline-flex' : 'none';
    if (calcBtn) calcBtn.style.display = step === total ? 'inline-flex' : 'none';
  }

  /**
   * Collects form data for the current step.
   * @param {number} step - Step number.
   */
  function collectStepData(step) {
    var stepKeys = ['transport', 'flights', 'energy', 'diet', 'shopping'];
    var key = stepKeys[step - 1];
    if (!key) return;

    var panel = $('step-panel-' + step);
    if (!panel) return;

    var inputs = panel.querySelectorAll('input, select');
    inputs.forEach(function (input) {
      if (!input.name) return;
      var val = input.type === 'checkbox' ? input.checked : input.value;
      // Sanitize: only allow expected chars in names
      var safeName = input.name.replace(/[^a-zA-Z0-9_]/g, '');
      if (safeName) {
        state.formData[key][safeName] = val;
      }
    });
  }

  /**
   * Validates required fields in current step.
   * @param {number} step - Step number.
   * @returns {boolean} Whether step is valid.
   */
  function validateStep(step) {
    var panel = $('step-panel-' + step);
    if (!panel) return true;

    var required = panel.querySelectorAll('[required]');
    var valid = true;

    required.forEach(function (input) {
      var err = input.parentNode.querySelector('.field-error');
      if (!input.value || input.value.trim() === '') {
        if (err) { err.textContent = 'This field is required.'; err.style.display = 'block'; }
        input.setAttribute('aria-invalid', 'true');
        valid = false;
      } else {
        if (err) err.style.display = 'none';
        input.setAttribute('aria-invalid', 'false');
      }
    });

    return valid;
  }

  /**
   * Goes to next step in wizard.
   */
  function nextStep() {
    collectStepData(state.currentStep);
    if (!validateStep(state.currentStep)) return;

    if (state.currentStep < state.totalSteps) {
      state.currentStep++;
      updateStepIndicator();
      var panel = $('step-panel-' + state.currentStep);
      if (panel) {
        var firstInput = panel.querySelector('input, select');
        if (firstInput) firstInput.focus();
      }
    }
  }

  /**
   * Goes to previous step in wizard.
   */
  function prevStep() {
    if (state.currentStep > 1) {
      collectStepData(state.currentStep);
      state.currentStep--;
      updateStepIndicator();
    }
  }

  /**
   * Runs the full calculation and navigates to dashboard.
   */
  function runCalculation() {
    collectStepData(state.currentStep);
    if (!validateStep(state.currentStep)) return;

    if (state.isCalculating) return;
    state.isCalculating = true;

    var calcBtn = $('btn-calculate');
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.textContent = 'Calculating...';
    }

    // Small delay for UX feedback
    setTimeout(function () {
      try {
        var result = CarbonCalculator.calculate(state.formData);
        state.lastResult = result;

        // Save to history
        var saveData = {
          total: result.total,
          score: result.score,
          breakdown: Object.keys(result.breakdown).reduce(function (acc, k) {
            acc[k] = result.breakdown[k].total;
            return acc;
          }, {}),
        };
        CarbonStorage.saveCalculation(saveData);

        // Update profile
        var profile = CarbonStorage.profile();
        CarbonStorage.profile({ totalCalculations: (profile.totalCalculations || 0) + 1 });

        // Check badges
        checkAndAwardBadges();

        navigateTo('dashboard');
      } catch (e) {
        showToast('Calculation error: ' + e.message, 'error');
        console.error('[CarbonApp] Calculation error:', e);
      } finally {
        state.isCalculating = false;
        if (calcBtn) {
          calcBtn.disabled = false;
          calcBtn.textContent = 'See My Footprint →';
        }
      }
    }, 600);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  /**
   * Renders the dashboard page with results.
   * @param {Object} result - Calculation result.
   */
  function renderDashboard(result) {
    if (!result) return;

    // Score ring
    setTimeout(function () {
      CarbonCharts.drawScoreRing('chart-score-ring', result.score, result.rating, result.total);
    }, 100);

    // Rating badge
    var ratingEl = $('dashboard-rating');
    if (ratingEl) {
      ratingEl.textContent = result.rating.label;
      ratingEl.style.color = result.rating.color;
      ratingEl.style.borderColor = result.rating.color + '55';
    }

    // Total tonnes
    setText('dashboard-total-tonnes', result.totalTonnes.toFixed(2));
    setText('dashboard-total-kg', result.total.toLocaleString());

    // Category bars
    setTimeout(function () {
      CarbonCharts.drawCategoryBars('chart-category-bars', result.breakdown, result.total);
    }, 200);

    // Comparison chart
    setTimeout(function () {
      CarbonCharts.drawComparison('chart-comparison', result.total, CarbonCalculator.BASELINES);
    }, 300);

    // Donut chart
    setTimeout(function () {
      CarbonCharts.drawDonut('chart-donut', result.percentages);
    }, 350);

    // Comparison stats
    var indiaRatio = result.comparison.india_average;
    var worldRatio = result.comparison.world_average;
    var parisRatio = result.comparison.paris_target;

    setText('stat-vs-india', (indiaRatio.ratio > 100 ? '+' : '') + (indiaRatio.ratio - 100) + '%');
    setText('stat-vs-world', (worldRatio.ratio > 100 ? '+' : '') + (worldRatio.ratio - 100) + '%');
    setText('stat-vs-paris', (parisRatio.ratio > 100 ? '+' : '') + (parisRatio.ratio - 100) + '%');

    var vsIndiaEl = $('stat-vs-india');
    if (vsIndiaEl) vsIndiaEl.style.color = indiaRatio.isAbove ? '#f87171' : '#4ade80';
    var vsWorldEl = $('stat-vs-world');
    if (vsWorldEl) vsWorldEl.style.color = worldRatio.isAbove ? '#f87171' : '#4ade80';
    var vsParis = $('stat-vs-paris');
    if (vsParis) vsParis.style.color = parisRatio.isAbove ? '#f87171' : '#4ade80';

    // Offset data
    setText('offset-trees', result.offset.treesNeeded.toLocaleString());
    setText('offset-solar', result.offset.solarPanelDays.toLocaleString());

    // Motivational message
    var msg = CarbonInsights.getMotivationalMessage(result.rating, result.total);
    setText('dashboard-message', msg);

    // Insights
    renderInsights(result);
  }

  /**
   * Renders personalized insights cards.
   * @param {Object} result - Calculation result.
   */
  function renderInsights(result) {
    var container = $('insights-container');
    if (!container) return;

    var insights = CarbonInsights.generateInsights(result, 6);
    container.innerHTML = '';

    if (insights.length === 0) {
      container.innerHTML = '<p style="color:rgba(240,253,244,0.6);text-align:center;">Great job! Keep tracking to get personalized insights.</p>';
      return;
    }

    insights.forEach(function (insight) {
      var card = document.createElement('article');
      card.className = 'insight-card insight-card-' + insight.difficulty;
      card.setAttribute('aria-label', insight.title);

      var difficultyLabel = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Advanced' }[insight.difficulty] || insight.difficulty;

      // Use textContent for all user-facing text to prevent XSS
      var header = document.createElement('div');
      header.className = 'insight-header';

      var iconSpan = document.createElement('span');
      iconSpan.className = 'insight-icon';
      iconSpan.textContent = insight.icon;

      var titleDiv = document.createElement('div');
      var titleH3 = document.createElement('h3');
      titleH3.className = 'insight-title';
      titleH3.textContent = insight.title;

      var diffSpan = document.createElement('span');
      diffSpan.className = 'insight-difficulty';
      diffSpan.textContent = difficultyLabel;

      titleDiv.appendChild(titleH3);
      titleDiv.appendChild(diffSpan);
      header.appendChild(iconSpan);
      header.appendChild(titleDiv);

      var desc = document.createElement('p');
      desc.className = 'insight-desc';
      desc.textContent = insight.description;

      var impact = document.createElement('div');
      impact.className = 'insight-impact';
      var impactSpan = document.createElement('span');
      impactSpan.textContent = '💚 Save ~' + insight.impactKg.toLocaleString() + ' kg CO₂e/year (' + insight.impactPercent + '%)';
      impact.appendChild(impactSpan);

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(impact);
      container.appendChild(card);
    });
  }

  // ─── Actions Page ─────────────────────────────────────────────────────────
  /**
   * Renders the eco-actions checklist page.
   */
  function renderActions() {
    var container = $('actions-container');
    if (!container) return;

    var savedActions = CarbonStorage.getActions();
    var categories = ['transport', 'flights', 'energy', 'diet', 'shopping'];
    var categoryNames = {
      transport: '🚗 Transport',
      flights: '✈️ Flights',
      energy: '⚡ Home Energy',
      diet: '🥗 Diet & Food',
      shopping: '🛍️ Shopping & Lifestyle',
    };

    container.innerHTML = '';
    var totalSavings = 0;
    var completedCount = 0;

    categories.forEach(function (cat) {
      var catActions = ECO_ACTIONS.filter(function (a) { return a.category === cat; });

      var section = document.createElement('section');
      section.className = 'action-category';
      section.setAttribute('aria-label', categoryNames[cat] + ' actions');

      var heading = document.createElement('h2');
      heading.className = 'action-category-title';
      heading.textContent = categoryNames[cat];
      section.appendChild(heading);

      var list = document.createElement('ul');
      list.className = 'action-list';
      list.setAttribute('role', 'list');

      catActions.forEach(function (action) {
        var isChecked = Boolean(savedActions[action.id]);
        if (isChecked) {
          totalSavings += action.savingKg;
          completedCount++;
        }

        var li = document.createElement('li');
        li.className = 'action-item' + (isChecked ? ' action-item-done' : '');
        li.setAttribute('role', 'listitem');

        var label = document.createElement('label');
        label.className = 'action-label';
        label.setAttribute('for', 'action-' + action.id);

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'action-' + action.id;
        checkbox.name = 'action-' + action.id;
        checkbox.checked = isChecked;
        checkbox.className = 'action-checkbox';
        checkbox.setAttribute('aria-label', action.title);

        checkbox.addEventListener('change', function (e) {
          var checked = e.target.checked;
          CarbonStorage.saveAction(action.id, checked);
          li.classList.toggle('action-item-done', checked);
          updateActionsTotals();
          checkAndAwardBadges();
        });

        var textDiv = document.createElement('div');
        textDiv.className = 'action-text';

        var titleSpan = document.createElement('span');
        titleSpan.className = 'action-title';
        titleSpan.textContent = action.title;

        var savingSpan = document.createElement('span');
        savingSpan.className = 'action-saving';
        savingSpan.textContent = '~' + action.savingKg.toLocaleString() + ' kg CO₂e saved/year';

        textDiv.appendChild(titleSpan);
        textDiv.appendChild(savingSpan);

        label.appendChild(checkbox);
        label.appendChild(textDiv);
        li.appendChild(label);
        list.appendChild(li);
      });

      section.appendChild(list);
      container.appendChild(section);
    });

    updateActionsTotals();
  }

  /**
   * Updates the action totals display.
   */
  function updateActionsTotals() {
    var savedActions = CarbonStorage.getActions();
    var totalSavings = 0;
    var completedCount = 0;

    ECO_ACTIONS.forEach(function (action) {
      if (savedActions[action.id]) {
        totalSavings += action.savingKg;
        completedCount++;
      }
    });

    setText('actions-total-savings', totalSavings.toLocaleString());
    setText('actions-count', completedCount);
    setText('actions-total', ECO_ACTIONS.length);

    var progressBar = $('actions-progress-bar');
    if (progressBar) {
      progressBar.style.width = ((completedCount / ECO_ACTIONS.length) * 100) + '%';
      progressBar.setAttribute('aria-valuenow', completedCount);
      progressBar.setAttribute('aria-valuemax', ECO_ACTIONS.length);
    }
  }

  // ─── Progress Page ────────────────────────────────────────────────────────
  /**
   * Renders the progress/history page.
   */
  function renderProgress() {
    var calculations = CarbonStorage.getCalculations();

    if (calculations.length === 0) {
      setDisplay('progress-empty', 'block');
      setDisplay('progress-charts', 'none');
      return;
    }

    setDisplay('progress-empty', 'none');
    setDisplay('progress-charts', 'block');

    // Stats
    var totals = calculations.map(function (c) { return c.total; });
    var latestTotal = totals[totals.length - 1];
    var firstTotal = totals[0];
    var reductionKg = Math.max(0, firstTotal - latestTotal);
    var reductionPercent = firstTotal > 0 ? Math.round((reductionKg / firstTotal) * 100) : 0;
    var avgTotal = Math.round(totals.reduce(function (a, b) { return a + b; }, 0) / totals.length);

    setText('progress-latest', latestTotal.toLocaleString());
    setText('progress-reduction', reductionKg.toLocaleString());
    setText('progress-reduction-percent', reductionPercent + '%');
    setText('progress-avg', avgTotal.toLocaleString());
    setText('progress-count', calculations.length);

    // Trend chart
    setTimeout(function () {
      CarbonCharts.drawTrendLine('chart-trend', calculations);
    }, 100);

    // History table
    renderHistoryTable(calculations);
  }

  /**
   * Renders the history table.
   * @param {Array} calculations - Calculation history.
   */
  function renderHistoryTable(calculations) {
    var tbody = $('history-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    var reversed = calculations.slice().reverse();

    reversed.forEach(function (calc, i) {
      var tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'table-row-even' : 'table-row-odd';

      var date = new Date(calc.date);
      var dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      var prevCalc = reversed[i + 1];
      var change = prevCalc ? calc.total - prevCalc.total : 0;
      var changeStr = change === 0 ? '—' : (change > 0 ? '+' : '') + Math.round(change) + ' kg';
      var changeColor = change > 0 ? '#f87171' : change < 0 ? '#4ade80' : 'rgba(240,253,244,0.5)';

      var rating = CarbonCalculator.getRating(calc.score || 50);

      var cells = [
        { text: dateStr, align: 'left' },
        { text: calc.total.toLocaleString() + ' kg', align: 'right' },
        { text: (calc.total / 1000).toFixed(2) + ' t', align: 'right' },
        { text: changeStr, align: 'right', color: changeColor },
        { text: rating.label, align: 'center', color: rating.color },
      ];

      cells.forEach(function (cell) {
        var td = document.createElement('td');
        td.className = 'table-cell';
        td.textContent = cell.text;
        td.style.textAlign = cell.align || 'left';
        if (cell.color) td.style.color = cell.color;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ─── Badges Page ─────────────────────────────────────────────────────────
  /**
   * Renders the badges/achievements page.
   */
  function renderBadges() {
    var container = $('badges-grid');
    if (!container) return;

    var earnedMap = CarbonStorage.getBadges();
    var allBadges = CarbonGamification.getAllBadges(earnedMap);
    var progress = CarbonGamification.getProgress(earnedMap);

    setText('badges-earned-count', progress.earned);
    setText('badges-total-count', progress.total);

    var progressBar = $('badges-progress-bar');
    if (progressBar) {
      progressBar.style.width = progress.percent + '%';
      progressBar.setAttribute('aria-valuenow', progress.earned);
      progressBar.setAttribute('aria-valuemax', progress.total);
    }

    container.innerHTML = '';

    allBadges.forEach(function (badge) {
      var card = document.createElement('article');
      card.className = 'badge-card' + (badge.earned ? ' badge-earned' : ' badge-locked');
      card.setAttribute('aria-label', badge.name + (badge.earned ? ' earned' : ' not yet earned'));
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.title = badge.description;

      if (badge.earned) {
        card.style.borderColor = badge.rarityColors.border;
        card.style.background = badge.rarityColors.bg;
      }

      var iconDiv = document.createElement('div');
      iconDiv.className = 'badge-icon';
      iconDiv.textContent = badge.earned ? badge.icon : '🔒';
      iconDiv.setAttribute('aria-hidden', 'true');

      var nameDiv = document.createElement('div');
      nameDiv.className = 'badge-name';
      nameDiv.textContent = badge.name;
      if (badge.earned) nameDiv.style.color = badge.rarityColors.text;

      var rarityDiv = document.createElement('div');
      rarityDiv.className = 'badge-rarity';
      rarityDiv.textContent = badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1);
      if (badge.earned) rarityDiv.style.color = badge.rarityColors.text;

      var descDiv = document.createElement('div');
      descDiv.className = 'badge-desc';
      descDiv.textContent = badge.description;

      if (badge.earned && badge.earnedAt) {
        var earnedDateDiv = document.createElement('div');
        earnedDateDiv.className = 'badge-earned-date';
        var d = new Date(badge.earnedAt);
        earnedDateDiv.textContent = 'Earned ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        card.appendChild(iconDiv);
        card.appendChild(nameDiv);
        card.appendChild(rarityDiv);
        card.appendChild(descDiv);
        card.appendChild(earnedDateDiv);
      } else {
        card.appendChild(iconDiv);
        card.appendChild(nameDiv);
        card.appendChild(rarityDiv);
        card.appendChild(descDiv);
      }

      // Keyboard accessibility
      card.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          showBadgeDetail(badge);
        }
      });
      card.addEventListener('click', function () {
        showBadgeDetail(badge);
      });

      container.appendChild(card);
    });
  }

  /**
   * Shows a badge detail modal.
   * @param {Object} badge - Badge object.
   */
  function showBadgeDetail(badge) {
    var modal = $('badge-modal');
    if (!modal) return;

    setText('modal-badge-icon', badge.icon);
    setText('modal-badge-name', badge.name);
    setText('modal-badge-rarity', badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1));
    setText('modal-badge-desc', badge.description);
    setText('modal-badge-status', badge.earned ? '✅ Earned!' : '🔒 Not yet earned');

    if (badge.earned) {
      var el = $('modal-badge-status');
      if (el) el.style.color = '#4ade80';
    }

    modal.classList.add('modal-open');
    modal.setAttribute('aria-hidden', 'false');

    var closeBtn = $('modal-close');
    if (closeBtn) closeBtn.focus();
  }

  // ─── Badge Checking ───────────────────────────────────────────────────────
  /**
   * Checks and awards any newly unlocked badges.
   */
  function checkAndAwardBadges() {
    var calculations = CarbonStorage.getCalculations();
    var actions = CarbonStorage.getActions();
    var existingBadges = CarbonStorage.getBadges();

    var newBadges = CarbonGamification.checkBadges(
      { calculations: calculations, actions: actions },
      existingBadges
    );

    newBadges.forEach(function (badge) {
      CarbonStorage.earnBadge(badge.id);
      showBadgeToast(badge);
    });
  }

  // ─── Toast Notifications ──────────────────────────────────────────────────
  /**
   * Shows a toast notification.
   * @param {string} message - Message text.
   * @param {string} [type='info'] - Toast type: 'info', 'success', 'error'.
   */
  function showToast(message, type) {
    var container = $('toast-container');
    if (!container) return;

    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    var textSpan = document.createElement('span');
    textSpan.textContent = String(message).substring(0, 200); // Limit message length
    toast.appendChild(textSpan);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () {
      toast.classList.add('toast-fade-out');
      setTimeout(function () { toast.remove(); }, 300);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(function () {
      if (toast.parentNode) {
        toast.classList.add('toast-fade-out');
        setTimeout(function () { toast.remove(); }, 300);
      }
    }, 4000);
  }

  /**
   * Shows a badge earned toast.
   * @param {Object} badge - Badge object.
   */
  function showBadgeToast(badge) {
    var container = $('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-badge';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'assertive');

    var icon = document.createElement('span');
    icon.className = 'toast-badge-icon';
    icon.textContent = badge.icon;
    icon.setAttribute('aria-hidden', 'true');

    var textDiv = document.createElement('div');
    var titleEl = document.createElement('strong');
    titleEl.textContent = '🏅 Badge Unlocked!';
    var nameEl = document.createElement('span');
    nameEl.textContent = badge.name;
    textDiv.appendChild(titleEl);
    textDiv.appendChild(document.createElement('br'));
    textDiv.appendChild(nameEl);

    toast.appendChild(icon);
    toast.appendChild(textDiv);
    container.appendChild(toast);

    // Launch confetti
    var confettiCanvas = $('confetti-canvas');
    if (confettiCanvas) CarbonGamification.launchConfetti(confettiCanvas);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.classList.add('toast-fade-out');
        setTimeout(function () { toast.remove(); }, 300);
      }
    }, 5000);
  }

  // ─── Particle Background ─────────────────────────────────────────────────
  /**
   * Initializes the floating particle background canvas.
   */
  function initParticles() {
    var canvas = $('particle-canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var particles = [];
    var NUM_PARTICLES = 40;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var emojis = ['🌿', '🍃', '🌱', '♻️', '🌎'];
    for (var i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vy: 0.2 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.3,
        opacity: 0.05 + Math.random() * 0.12,
        size: 12 + Math.random() * 18,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 0.5,
      });
    }

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(function (p) {
        p.y -= p.vy;
        p.x += p.vx;
        p.rotation += p.rotSpeed;

        if (p.y < -30) {
          p.y = canvas.height + 30;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.font = p.size + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      });

      requestAnimationFrame(animateParticles);
    }

    animateParticles();
  }

  // ─── Animated Counter ─────────────────────────────────────────────────────
  /**
   * Animates a number counter from 0 to target.
   * @param {HTMLElement} el - Target element.
   * @param {number} target - Target number.
   * @param {number} [duration=1500] - Animation duration in ms.
   */
  function animateCounter(el, target, duration) {
    if (!el) return;
    duration = duration || 1500;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Home Page Stats ─────────────────────────────────────────────────────
  /**
   * Initializes animated home page stats.
   */
  function initHomeStats() {
    var stats = [
      { id: 'stat-world-avg', value: 4800 },
      { id: 'stat-india-avg', value: 1900 },
      { id: 'stat-paris-target', value: 2000 },
    ];

    // Intersection Observer to trigger when visible
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            stats.forEach(function (s) {
              animateCounter($(s.id), s.value);
            });
            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });

      var statsSection = $('home-stats');
      if (statsSection) observer.observe(statsSection);
    } else {
      stats.forEach(function (s) { setText(s.id, s.value.toLocaleString()); });
    }
  }

  // ─── Form Range Sliders ───────────────────────────────────────────────────
  /**
   * Syncs range input value display.
   */
  function initRangeDisplays() {
    var ranges = document.querySelectorAll('input[type="range"][data-display]');
    ranges.forEach(function (range) {
      var displayId = range.getAttribute('data-display');
      var unit = range.getAttribute('data-unit') || '';
      var display = $(displayId);
      if (display) {
        display.textContent = range.value + unit;
        range.addEventListener('input', function () {
          display.textContent = range.value + unit;
        });
      }
    });
  }

  // ─── Dark/Light Theme ─────────────────────────────────────────────────────
  /**
   * Toggles theme.
   */
  function toggleTheme() {
    var root = document.documentElement;
    var isLight = root.classList.toggle('light-theme');
    CarbonStorage.settings({ theme: isLight ? 'light' : 'dark' });
    var btn = $('theme-toggle');
    if (btn) {
      btn.textContent = isLight ? '🌙' : '☀️';
      btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    }
  }

  // ─── Data Export ─────────────────────────────────────────────────────────
  /**
   * Exports user data as a JSON download.
   */
  function exportData() {
    var data = CarbonStorage.exportData();
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'carbon-footprint-data-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
  }

  // ─── Reset Data ───────────────────────────────────────────────────────────
  /**
   * Resets all app data after confirmation.
   */
  function resetData() {
    var confirmed = window.confirm('Are you sure you want to reset all your data? This cannot be undone.');
    if (confirmed) {
      CarbonStorage.clearAll();
      state.lastResult = null;
      state.formData = { transport: {}, flights: {}, energy: {}, diet: {}, shopping: {} };
      state.currentStep = 1;
      showToast('All data has been reset.', 'info');
      navigateTo('home');
    }
  }

  // ─── Event Binding ────────────────────────────────────────────────────────
  /**
   * Binds all event listeners.
   */
  function bindEvents() {
    // Nav tabs
    var navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        navigateTo(tab.dataset.page);
      });
      tab.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' || e.key === ' ') navigateTo(tab.dataset.page);
      });
    });

    // CTA buttons
    var startBtn = $('btn-start-calculator');
    if (startBtn) startBtn.addEventListener('click', function () { navigateTo('calculator'); });

    var startBtn2 = $('btn-start-calculator-2');
    if (startBtn2) startBtn2.addEventListener('click', function () { navigateTo('calculator'); });

    // Calculator navigation
    var nextBtn = $('btn-next');
    if (nextBtn) nextBtn.addEventListener('click', nextStep);

    var prevBtn = $('btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', prevStep);

    var calcBtn = $('btn-calculate');
    if (calcBtn) calcBtn.addEventListener('click', runCalculation);

    // Dashboard actions
    var reCalcBtn = $('btn-recalculate');
    if (reCalcBtn) reCalcBtn.addEventListener('click', function () {
      state.currentStep = 1;
      updateStepIndicator();
      navigateTo('calculator');
    });

    var viewActionsBtn = $('btn-view-actions');
    if (viewActionsBtn) viewActionsBtn.addEventListener('click', function () { navigateTo('actions'); });

    // Theme toggle
    var themeBtn = $('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Export data
    var exportBtn = $('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    // Reset data
    var resetBtn = $('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetData);

    // Modal close
    var modalClose = $('modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', function () {
        var modal = $('badge-modal');
        if (modal) {
          modal.classList.remove('modal-open');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    var modal = $('badge-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          modal.classList.remove('modal-open');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          modal.classList.remove('modal-open');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Skip link
    var skipLink = $('skip-link');
    if (skipLink) {
      skipLink.addEventListener('click', function (e) {
        e.preventDefault();
        var main = $('main-content');
        if (main) {
          main.setAttribute('tabindex', '-1');
          main.focus();
        }
      });
    }

    // Keyboard: Escape closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var openModal = document.querySelector('.modal-open');
        if (openModal) {
          openModal.classList.remove('modal-open');
          openModal.setAttribute('aria-hidden', 'true');
        }
      }
    });
  }

  // ─── Initialize ───────────────────────────────────────────────────────────
  /**
   * Initializes the application.
   */
  function init() {
    // Restore theme preference
    var storedSettings = CarbonStorage.settings();
    if (storedSettings.theme === 'light') {
      document.documentElement.classList.add('light-theme');
      var btn = $('theme-toggle');
      if (btn) { btn.textContent = '🌙'; btn.setAttribute('aria-label', 'Switch to dark mode'); }
    }

    // Initialize profile (creates if doesn't exist)
    CarbonStorage.profile();

    // Bind all events
    bindEvents();

    // Initialize step indicator
    updateStepIndicator();

    // Initialize home page stats
    initHomeStats();

    // Initialize range sliders
    initRangeDisplays();

    // Initialize particle background
    initParticles();

    // Start on home page
    navigateTo('home');

    // Check for existing data
    var calculations = CarbonStorage.getCalculations();
    if (calculations.length > 0) {
      var lastCalc = calculations[calculations.length - 1];
      // Reconstruct minimal state.lastResult from stored data for dashboard
      if (lastCalc) {
        try {
          var reconstructed = CarbonCalculator.getRating(lastCalc.score || 50);
          state.lastResult = {
            total: lastCalc.total,
            totalTonnes: Math.round((lastCalc.total / 1000) * 100) / 100,
            score: lastCalc.score || 50,
            rating: reconstructed,
            breakdown: lastCalc.breakdown
              ? Object.keys(lastCalc.breakdown).reduce(function (acc, k) {
                  acc[k] = { total: lastCalc.breakdown[k] };
                  return acc;
                }, {})
              : { transport: { total: 0 }, flights: { total: 0 }, energy: { total: 0 }, diet: { total: 0 }, shopping: { total: 0 } },
            percentages: {},
            comparison: CarbonCalculator.compareToBaselines(lastCalc.total),
            offset: CarbonCalculator.calculateOffset(lastCalc.total),
          };
          // Calculate percentages from stored breakdown
          if (lastCalc.breakdown) {
            var total = lastCalc.total;
            Object.keys(lastCalc.breakdown).forEach(function (k) {
              state.lastResult.percentages[k] = total > 0
                ? Math.round((lastCalc.breakdown[k] / total) * 100) : 0;
            });
          }
        } catch (e) {
          console.warn('[CarbonApp] Could not reconstruct last result:', e);
        }
      }
    }

    console.log('[CarbonApp] Initialized successfully');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    navigateTo: navigateTo,
    showToast: showToast,
    exportData: exportData,
    resetData: resetData,
  };
})();
