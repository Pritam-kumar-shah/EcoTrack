/**
 * @fileoverview Main application controller for Carbon Footprint Awareness Platform.
 * Manages routing, UI state, form handling, and orchestrates all modules.
 * @version 2.0.0
 */

/**
 * @typedef {Object} AppState
 * @property {string} currentPage - Currently active page name.
 * @property {number} currentStep - Current wizard step (1-5).
 * @property {number} totalSteps - Total wizard steps.
 * @property {Object|null} lastResult - Last calculation result.
 * @property {Object} formData - Collected form data by category.
 * @property {boolean} isCalculating - Whether calculation is in progress.
 * @property {number|null} particleAnimId - requestAnimationFrame ID for particles.
 */

/**
 * @typedef {Object} EcoAction
 * @property {string} id - Unique action identifier.
 * @property {string} category - Category: 'transport'|'flights'|'energy'|'diet'|'shopping'.
 * @property {string} title - Display title.
 * @property {number} savingKg - Estimated annual CO₂ savings in kg.
 * @property {string} icon - Emoji icon.
 * @property {string} difficulty - Difficulty level: 'easy'|'medium'|'hard'.
 */

var CarbonApp = (function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────────
  /** @type {number} Delay in ms for calculation UX feedback */
  const CALCULATION_UX_DELAY_MS = 600;
  /** @type {number} Toast auto-dismiss duration in ms */
  const TOAST_DURATION_MS = 4000;
  /** @type {number} Badge toast duration in ms (longer for celebration) */
  const BADGE_TOAST_DURATION_MS = 5000;
  /** @type {number} Toast fade-out animation duration in ms */
  const TOAST_FADE_MS = 300;
  /** @type {number} Default score when score is missing from stored data */
  const DEFAULT_SCORE = 50;
  /** @type {number} Maximum toast message length */
  const MAX_TOAST_LENGTH = 200;
  /** @type {number} Debounce delay for resize events in ms */
  const RESIZE_DEBOUNCE_MS = 150;
  /** @type {Array<string>} Valid page names for navigation */
  const VALID_PAGES = ['home', 'calculator', 'dashboard', 'actions', 'progress', 'badges'];

  // ─── App State ────────────────────────────────────────────────────────────
  /** @type {AppState} */
  const state = {
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
    particleAnimId: null,
  };

  // Eco-actions library
  /** @type {Array<EcoAction>} */
  const ECO_ACTIONS = [
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

  // ─── Utility Helpers ──────────────────────────────────────────────────────

  /**
   * Creates a debounced version of a function.
   * @param {Function} fn - Function to debounce.
   * @param {number} delay - Delay in milliseconds.
   * @returns {Function} Debounced function.
   */
  function debounce(fn, delay) {
    let timer = null;
    return function () {
      const context = this;
      const args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  /**
   * Clears all child nodes from an element (CSP-friendly alternative to innerHTML='').
   * @param {HTMLElement} element - Element to clear.
   */
  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Closes the badge detail modal.
   */
  function closeModal() {
    const modal = $('badge-modal');
    if (modal) {
      modal.classList.remove('modal-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Validates a Date object for correctness.
   * @param {Date} date - Date to validate.
   * @returns {boolean} Whether the date is valid.
   */
  function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

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
    const el = $(id);
    if (el) el.textContent = String(text);
  }

  /**
   * Sets display style.
   * @param {string} id - Element ID.
   * @param {string} display - CSS display value.
   */
  function setDisplay(id, display) {
    const el = $(id);
    if (el) el.style.display = display;
  }

  // ─── Navigation / Routing ────────────────────────────────────────────────
  /**
   * Navigates to a page by ID.
   * @param {string} pageName - Page to navigate to. Must be one of VALID_PAGES.
   */
  function navigateTo(pageName) {
    // Validate page name against whitelist
    if (VALID_PAGES.indexOf(pageName) === -1) {
      console.warn('[CarbonApp] Invalid page name:', pageName);
      return;
    }

    const pages = document.querySelectorAll('.page-section');
    pages.forEach(function (p) {
      p.classList.remove('page-active');
      p.setAttribute('aria-hidden', 'true');
    });

    const target = $('page-' + pageName);
    if (target) {
      target.classList.add('page-active');
      target.setAttribute('aria-hidden', 'false');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update nav tabs
    const navBtns = document.querySelectorAll('.nav-tab');
    navBtns.forEach(function (btn) {
      btn.classList.toggle('nav-tab-active', btn.dataset.page === pageName);
      btn.setAttribute('aria-current', btn.dataset.page === pageName ? 'page' : 'false');
    });

    state.currentPage = pageName;

    // Pause/resume particle animation based on page visibility
    if (pageName === 'home') {
      resumeParticles();
    } else {
      pauseParticles();
    }

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
    const step = state.currentStep;
    const total = state.totalSteps;

    // Update progress bar
    const bar = $('calc-progress-bar');
    if (bar) bar.style.width = ((step / total) * 100) + '%';

    // Update step number text
    setText('step-current', step);
    setText('step-total', total);

    // Update step indicator dots
    const dots = document.querySelectorAll('.step-dot');
    dots.forEach(function (dot, i) {
      dot.classList.toggle('step-dot-active', i < step);
      dot.classList.toggle('step-dot-current', i === step - 1);
      dot.setAttribute('aria-label', 'Step ' + (i + 1) + (i < step ? ' complete' : ''));
    });

    // Show/hide step panels
    for (let s = 1; s <= total; s++) {
      const panel = $('step-panel-' + s);
      if (panel) {
        panel.classList.toggle('step-panel-active', s === step);
        panel.setAttribute('aria-hidden', s !== step ? 'true' : 'false');
      }
    }

    // Prev/Next buttons
    const prevBtn = $('btn-prev');
    const nextBtn = $('btn-next');
    const calcBtn = $('btn-calculate');

    if (prevBtn) prevBtn.disabled = step === 1;
    if (nextBtn) nextBtn.style.display = step < total ? 'inline-flex' : 'none';
    if (calcBtn) calcBtn.style.display = step === total ? 'inline-flex' : 'none';
  }

  /**
   * Collects form data for the current step.
   * @param {number} step - Step number.
   */
  function collectStepData(step) {
    const stepKeys = ['transport', 'flights', 'energy', 'diet', 'shopping'];
    const key = stepKeys[step - 1];
    if (!key) return;

    const panel = $('step-panel-' + step);
    if (!panel) return;

    const inputs = panel.querySelectorAll('input, select');
    inputs.forEach(function (input) {
      if (!input.name) return;
      const val = input.type === 'checkbox' ? input.checked : input.value;
      // Sanitize: only allow expected chars in names
      const safeName = input.name.replace(/[^a-zA-Z0-9_]/g, '');
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
    const panel = $('step-panel-' + step);
    if (!panel) return true;

    const required = panel.querySelectorAll('[required]');
    let valid = true;

    required.forEach(function (input) {
      const err = input.parentNode.querySelector('.field-error');
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
      const panel = $('step-panel-' + state.currentStep);
      if (panel) {
        const firstInput = panel.querySelector('input, select');
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

    const calcBtn = $('btn-calculate');
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.textContent = 'Calculating...';
    }

    // Small delay for UX feedback
    setTimeout(function () {
      try {
        const result = CarbonCalculator.calculate(state.formData);
        state.lastResult = result;

        // Save to history
        const saveData = {
          total: result.total,
          score: result.score,
          breakdown: Object.keys(result.breakdown).reduce(function (acc, k) {
            acc[k] = result.breakdown[k].total;
            return acc;
          }, {}),
        };
        CarbonStorage.saveCalculation(saveData);

        // Update profile
        const profile = CarbonStorage.profile();
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
    }, CALCULATION_UX_DELAY_MS);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  /**
   * Renders the dashboard page with results.
   * @param {Object} result - Calculation result.
   */
  function renderDashboard(result) {
    if (!result) return;

    // Score ring — wrapped in try/catch for error boundary
    setTimeout(function () {
      try {
        CarbonCharts.drawScoreRing('chart-score-ring', result.score, result.rating, result.total);
      } catch (e) {
        console.error('[CarbonApp] Score ring render error:', e);
      }
    }, 100);

    // Rating badge
    const ratingEl = $('dashboard-rating');
    if (ratingEl) {
      ratingEl.textContent = result.rating.label;
      ratingEl.style.color = result.rating.color;
      ratingEl.style.borderColor = result.rating.color + '55';
    }

    // Total tonnes
    setText('dashboard-total-tonnes', result.totalTonnes.toFixed(2));
    setText('dashboard-total-kg', result.total.toLocaleString());

    // Category bars — wrapped in try/catch for error boundary
    setTimeout(function () {
      try {
        CarbonCharts.drawCategoryBars('chart-category-bars', result.breakdown, result.total);
      } catch (e) {
        console.error('[CarbonApp] Category bars render error:', e);
      }
    }, 200);

    // Comparison chart — wrapped in try/catch for error boundary
    setTimeout(function () {
      try {
        CarbonCharts.drawComparison('chart-comparison', result.total, CarbonCalculator.BASELINES);
      } catch (e) {
        console.error('[CarbonApp] Comparison chart render error:', e);
      }
    }, 300);

    // Donut chart — wrapped in try/catch for error boundary
    setTimeout(function () {
      try {
        CarbonCharts.drawDonut('chart-donut', result.percentages);
      } catch (e) {
        console.error('[CarbonApp] Donut chart render error:', e);
      }
    }, 350);

    // Comparison stats
    const indiaRatio = result.comparison.india_average;
    const worldRatio = result.comparison.world_average;
    const parisRatio = result.comparison.paris_target;

    setText('stat-vs-india', (indiaRatio.ratio > 100 ? '+' : '') + (indiaRatio.ratio - 100) + '%');
    setText('stat-vs-world', (worldRatio.ratio > 100 ? '+' : '') + (worldRatio.ratio - 100) + '%');
    setText('stat-vs-paris', (parisRatio.ratio > 100 ? '+' : '') + (parisRatio.ratio - 100) + '%');

    const vsIndiaEl = $('stat-vs-india');
    if (vsIndiaEl) vsIndiaEl.style.color = indiaRatio.isAbove ? '#f87171' : '#4ade80';
    const vsWorldEl = $('stat-vs-world');
    if (vsWorldEl) vsWorldEl.style.color = worldRatio.isAbove ? '#f87171' : '#4ade80';
    const vsParisEl = $('stat-vs-paris');
    if (vsParisEl) vsParisEl.style.color = parisRatio.isAbove ? '#f87171' : '#4ade80';

    // Offset data
    setText('offset-trees', result.offset.treesNeeded.toLocaleString());
    setText('offset-solar', result.offset.solarPanelDays.toLocaleString());

    // Motivational message
    const msg = CarbonInsights.getMotivationalMessage(result.rating, result.total);
    setText('dashboard-message', msg);

    // Insights
    renderInsights(result);
  }

  /**
   * Renders personalized insights cards.
   * @param {Object} result - Calculation result.
   */
  function renderInsights(result) {
    const container = $('insights-container');
    if (!container) return;

    const insights = CarbonInsights.generateInsights(result, 6);
    clearChildren(container);

    if (insights.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'insights-placeholder';
      placeholder.textContent = 'Great job! Keep tracking to get personalized insights.';
      container.appendChild(placeholder);
      return;
    }

    insights.forEach(function (insight) {
      const card = document.createElement('article');
      card.className = 'insight-card insight-card-' + insight.difficulty;
      card.setAttribute('aria-label', insight.title);

      const difficultyLabel = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Advanced' }[insight.difficulty] || insight.difficulty;

      // Use textContent for all user-facing text to prevent XSS
      const header = document.createElement('div');
      header.className = 'insight-header';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'insight-icon';
      iconSpan.textContent = insight.icon;

      const titleDiv = document.createElement('div');
      const titleH3 = document.createElement('h3');
      titleH3.className = 'insight-title';
      titleH3.textContent = insight.title;

      const diffSpan = document.createElement('span');
      diffSpan.className = 'insight-difficulty';
      diffSpan.textContent = difficultyLabel;

      titleDiv.appendChild(titleH3);
      titleDiv.appendChild(diffSpan);
      header.appendChild(iconSpan);
      header.appendChild(titleDiv);

      const desc = document.createElement('p');
      desc.className = 'insight-desc';
      desc.textContent = insight.description;

      const impact = document.createElement('div');
      impact.className = 'insight-impact';
      const impactSpan = document.createElement('span');
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
    const container = $('actions-container');
    if (!container) return;

    const savedActions = CarbonStorage.getActions();
    const categories = ['transport', 'flights', 'energy', 'diet', 'shopping'];
    const categoryNames = {
      transport: '🚗 Transport',
      flights: '✈️ Flights',
      energy: '⚡ Home Energy',
      diet: '🥗 Diet & Food',
      shopping: '🛍️ Shopping & Lifestyle',
    };

    clearChildren(container);

    categories.forEach(function (cat) {
      const catActions = ECO_ACTIONS.filter(function (a) { return a.category === cat; });

      const section = document.createElement('section');
      section.className = 'action-category';
      section.setAttribute('aria-label', categoryNames[cat] + ' actions');

      const heading = document.createElement('h2');
      heading.className = 'action-category-title';
      heading.textContent = categoryNames[cat];
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'action-list';
      list.setAttribute('role', 'list');

      catActions.forEach(function (action) {
        const isChecked = Boolean(savedActions[action.id]);

        const li = document.createElement('li');
        li.className = 'action-item' + (isChecked ? ' action-item-done' : '');
        li.setAttribute('role', 'listitem');

        const label = document.createElement('label');
        label.className = 'action-label';
        label.setAttribute('for', 'action-' + action.id);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'action-' + action.id;
        checkbox.name = 'action-' + action.id;
        checkbox.checked = isChecked;
        checkbox.className = 'action-checkbox';
        checkbox.setAttribute('aria-label', action.title);

        checkbox.addEventListener('change', function (e) {
          const checked = e.target.checked;
          CarbonStorage.saveAction(action.id, checked);
          li.classList.toggle('action-item-done', checked);
          updateActionsTotals();
          checkAndAwardBadges();
        });

        const textDiv = document.createElement('div');
        textDiv.className = 'action-text';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'action-title';
        titleSpan.textContent = action.title;

        const savingSpan = document.createElement('span');
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
    const savedActions = CarbonStorage.getActions();
    let totalSavings = 0;
    let completedCount = 0;

    ECO_ACTIONS.forEach(function (action) {
      if (savedActions[action.id]) {
        totalSavings += action.savingKg;
        completedCount++;
      }
    });

    setText('actions-total-savings', totalSavings.toLocaleString());
    setText('actions-count', completedCount);
    setText('actions-total', ECO_ACTIONS.length);

    const progressBar = $('actions-progress-bar');
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
    const calculations = CarbonStorage.getCalculations();

    if (calculations.length === 0) {
      setDisplay('progress-empty', 'block');
      setDisplay('progress-charts', 'none');
      return;
    }

    setDisplay('progress-empty', 'none');
    setDisplay('progress-charts', 'block');

    // Stats
    const totals = calculations.map(function (c) { return c.total; });
    const latestTotal = totals[totals.length - 1];
    const firstTotal = totals[0];
    const reductionKg = Math.max(0, firstTotal - latestTotal);
    const reductionPercent = firstTotal > 0 ? Math.round((reductionKg / firstTotal) * 100) : 0;
    const avgTotal = Math.round(totals.reduce(function (a, b) { return a + b; }, 0) / totals.length);

    setText('progress-latest', latestTotal.toLocaleString());
    setText('progress-reduction', reductionKg.toLocaleString());
    setText('progress-reduction-percent', reductionPercent + '%');
    setText('progress-avg', avgTotal.toLocaleString());
    setText('progress-count', calculations.length);

    // Trend chart
    setTimeout(function () {
      try {
        CarbonCharts.drawTrendLine('chart-trend', calculations);
      } catch (e) {
        console.error('[CarbonApp] Trend chart render error:', e);
      }
    }, 100);

    // History table
    renderHistoryTable(calculations);
  }

  /**
   * Renders the history table.
   * @param {Array} calculations - Calculation history.
   */
  function renderHistoryTable(calculations) {
    const tbody = $('history-table-body');
    if (!tbody) return;

    clearChildren(tbody);
    const reversed = calculations.slice().reverse();

    reversed.forEach(function (calc, i) {
      const tr = document.createElement('tr');
      tr.className = i % 2 === 0 ? 'table-row-even' : 'table-row-odd';

      const date = new Date(calc.date);
      const dateStr = isValidDate(date)
        ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Unknown date';

      const prevCalc = reversed[i + 1];
      const change = prevCalc ? calc.total - prevCalc.total : 0;
      const changeStr = change === 0 ? '—' : (change > 0 ? '+' : '') + Math.round(change) + ' kg';
      const changeColor = change > 0 ? '#f87171' : change < 0 ? '#4ade80' : 'rgba(240,253,244,0.5)';

      const rating = CarbonCalculator.getRating(calc.score || DEFAULT_SCORE);

      const cells = [
        { text: dateStr, align: 'left' },
        { text: calc.total.toLocaleString() + ' kg', align: 'right' },
        { text: (calc.total / 1000).toFixed(2) + ' t', align: 'right' },
        { text: changeStr, align: 'right', color: changeColor },
        { text: rating.label, align: 'center', color: rating.color },
      ];

      cells.forEach(function (cell) {
        const td = document.createElement('td');
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
    const container = $('badges-grid');
    if (!container) return;

    const earnedMap = CarbonStorage.getBadges();
    const allBadges = CarbonGamification.getAllBadges(earnedMap);
    const progress = CarbonGamification.getProgress(earnedMap);

    setText('badges-earned-count', progress.earned);
    setText('badges-total-count', progress.total);

    const progressBar = $('badges-progress-bar');
    if (progressBar) {
      progressBar.style.width = progress.percent + '%';
      progressBar.setAttribute('aria-valuenow', progress.earned);
      progressBar.setAttribute('aria-valuemax', progress.total);
    }

    clearChildren(container);

    allBadges.forEach(function (badge) {
      const card = document.createElement('article');
      card.className = 'badge-card' + (badge.earned ? ' badge-earned' : ' badge-locked');
      card.setAttribute('aria-label', badge.name + (badge.earned ? ' earned' : ' not yet earned'));
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.title = badge.description;

      if (badge.earned) {
        card.style.borderColor = badge.rarityColors.border;
        card.style.background = badge.rarityColors.bg;
      }

      const iconDiv = document.createElement('div');
      iconDiv.className = 'badge-icon';
      iconDiv.textContent = badge.earned ? badge.icon : '🔒';
      iconDiv.setAttribute('aria-hidden', 'true');

      const nameDiv = document.createElement('div');
      nameDiv.className = 'badge-name';
      nameDiv.textContent = badge.name;
      if (badge.earned) nameDiv.style.color = badge.rarityColors.text;

      const rarityDiv = document.createElement('div');
      rarityDiv.className = 'badge-rarity';
      rarityDiv.textContent = badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1);
      if (badge.earned) rarityDiv.style.color = badge.rarityColors.text;

      const descDiv = document.createElement('div');
      descDiv.className = 'badge-desc';
      descDiv.textContent = badge.description;

      // Append common elements first, then conditionally add earned date
      card.appendChild(iconDiv);
      card.appendChild(nameDiv);
      card.appendChild(rarityDiv);
      card.appendChild(descDiv);

      if (badge.earned && badge.earnedAt) {
        const earnedDateDiv = document.createElement('div');
        earnedDateDiv.className = 'badge-earned-date';
        const d = new Date(badge.earnedAt);
        earnedDateDiv.textContent = isValidDate(d)
          ? 'Earned ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Earned';
        card.appendChild(earnedDateDiv);
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
    const modal = $('badge-modal');
    if (!modal) return;

    setText('modal-badge-icon', badge.icon);
    setText('modal-badge-name', badge.name);
    setText('modal-badge-rarity', badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1));
    setText('modal-badge-desc', badge.description);
    setText('modal-badge-status', badge.earned ? '✅ Earned!' : '🔒 Not yet earned');

    if (badge.earned) {
      const el = $('modal-badge-status');
      if (el) el.style.color = '#4ade80';
    }

    modal.classList.add('modal-open');
    modal.setAttribute('aria-hidden', 'false');

    const closeBtn = $('modal-close');
    if (closeBtn) closeBtn.focus();
  }

  // ─── Badge Checking ───────────────────────────────────────────────────────
  /**
   * Checks and awards any newly unlocked badges.
   */
  function checkAndAwardBadges() {
    const calculations = CarbonStorage.getCalculations();
    const actions = CarbonStorage.getActions();
    const existingBadges = CarbonStorage.getBadges();

    const newBadges = CarbonGamification.checkBadges(
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
    const container = $('toast-container');
    if (!container) return;

    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const textSpan = document.createElement('span');
    textSpan.textContent = String(message).substring(0, MAX_TOAST_LENGTH);
    toast.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () {
      toast.classList.add('toast-fade-out');
      setTimeout(function () { toast.remove(); }, TOAST_FADE_MS);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto-remove after configured duration
    setTimeout(function () {
      if (toast.parentNode) {
        toast.classList.add('toast-fade-out');
        setTimeout(function () { toast.remove(); }, TOAST_FADE_MS);
      }
    }, TOAST_DURATION_MS);
  }

  /**
   * Shows a badge earned toast.
   * @param {Object} badge - Badge object.
   */
  function showBadgeToast(badge) {
    const container = $('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-badge';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'assertive');

    const icon = document.createElement('span');
    icon.className = 'toast-badge-icon';
    icon.textContent = badge.icon;
    icon.setAttribute('aria-hidden', 'true');

    const textDiv = document.createElement('div');
    const titleEl = document.createElement('strong');
    titleEl.textContent = '🏅 Badge Unlocked!';
    const nameEl = document.createElement('span');
    nameEl.textContent = badge.name;
    textDiv.appendChild(titleEl);
    textDiv.appendChild(document.createElement('br'));
    textDiv.appendChild(nameEl);

    toast.appendChild(icon);
    toast.appendChild(textDiv);
    container.appendChild(toast);

    // Launch confetti
    const confettiCanvas = $('confetti-canvas');
    if (confettiCanvas) CarbonGamification.launchConfetti(confettiCanvas);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.classList.add('toast-fade-out');
        setTimeout(function () { toast.remove(); }, TOAST_FADE_MS);
      }
    }, BADGE_TOAST_DURATION_MS);
  }

  // ─── Particle Background ─────────────────────────────────────────────────
  /** @type {Array} Particle objects for background animation */
  let particles = [];
  /** @type {CanvasRenderingContext2D|null} Particle canvas context */
  let particleCtx = null;
  /** @type {HTMLCanvasElement|null} Particle canvas element */
  let particleCanvas = null;

  /**
   * Pauses particle animation to save CPU when not on home page.
   */
  function pauseParticles() {
    if (state.particleAnimId) {
      cancelAnimationFrame(state.particleAnimId);
      state.particleAnimId = null;
    }
  }

  /**
   * Resumes particle animation when returning to home page.
   */
  function resumeParticles() {
    if (!state.particleAnimId && particleCtx && particleCanvas) {
      animateParticles();
    }
  }

  /**
   * Renders one frame of the particle animation loop.
   */
  function animateParticles() {
    if (!particleCtx || !particleCanvas) return;

    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    particles.forEach(function (p) {
      p.y -= p.vy;
      p.x += p.vx;
      p.rotation += p.rotSpeed;

      if (p.y < -30) {
        p.y = particleCanvas.height + 30;
        p.x = Math.random() * particleCanvas.width;
      }

      particleCtx.save();
      particleCtx.globalAlpha = p.opacity;
      particleCtx.translate(p.x, p.y);
      particleCtx.rotate((p.rotation * Math.PI) / 180);
      particleCtx.font = p.size + 'px serif';
      particleCtx.textAlign = 'center';
      particleCtx.textBaseline = 'middle';
      particleCtx.fillText(p.emoji, 0, 0);
      particleCtx.restore();
    });

    state.particleAnimId = requestAnimationFrame(animateParticles);
  }

  /**
   * Initializes the floating particle background canvas.
   */
  function initParticles() {
    particleCanvas = $('particle-canvas');
    if (!particleCanvas) return;

    particleCtx = particleCanvas.getContext('2d');
    const NUM_PARTICLES = 40;

    function resize() {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', debounce(resize, RESIZE_DEBOUNCE_MS));

    const emojis = ['🌿', '🍃', '🌱', '♻️', '🌎'];
    for (let i = 0; i < NUM_PARTICLES; i++) {
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
    let startTime = null;

    /**
     * Animation step callback for requestAnimationFrame.
     * @param {DOMHighResTimeStamp} timestamp - Current timestamp.
     */
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
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
    const stats = [
      { id: 'stat-world-avg', value: 4800 },
      { id: 'stat-india-avg', value: 1900 },
      { id: 'stat-paris-target', value: 2000 },
    ];

    // Intersection Observer to trigger when visible
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            stats.forEach(function (s) {
              animateCounter($(s.id), s.value);
            });
            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });

      const statsSection = $('home-stats');
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
    const ranges = document.querySelectorAll('input[type="range"][data-display]');
    ranges.forEach(function (range) {
      const displayId = range.getAttribute('data-display');
      const unit = range.getAttribute('data-unit') || '';
      const display = $(displayId);
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
    const root = document.documentElement;
    const isLight = root.classList.toggle('light-theme');
    CarbonStorage.settings({ theme: isLight ? 'light' : 'dark' });
    const btn = $('theme-toggle');
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
    const data = CarbonStorage.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
    const confirmed = window.confirm('Are you sure you want to reset all your data? This cannot be undone.');
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
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        navigateTo(tab.dataset.page);
      });
      tab.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' || e.key === ' ') navigateTo(tab.dataset.page);
      });
    });

    // CTA buttons — use JS event listeners instead of inline onclick
    const startBtn = $('btn-start-calculator');
    if (startBtn) startBtn.addEventListener('click', function () { navigateTo('calculator'); });

    const startBtn2 = $('btn-start-calculator-2');
    if (startBtn2) startBtn2.addEventListener('click', function () { navigateTo('calculator'); });

    // Logo click — replaces inline onclick
    const logoLink = document.querySelector('.logo-link');
    if (logoLink) {
      logoLink.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo('home');
      });
    }

    // "Take Action Now" CTA — replaces inline onclick
    const takeActionBtn = $('btn-take-action-cta');
    if (takeActionBtn) {
      takeActionBtn.addEventListener('click', function () {
        navigateTo('actions');
      });
    }

    // Progress empty CTA — replaces inline onclick
    const progressCta = $('btn-progress-cta');
    if (progressCta) {
      progressCta.addEventListener('click', function () {
        navigateTo('calculator');
      });
    }

    // Calculator navigation
    const nextBtn = $('btn-next');
    if (nextBtn) nextBtn.addEventListener('click', nextStep);

    const prevBtn = $('btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', prevStep);

    const calcBtn = $('btn-calculate');
    if (calcBtn) calcBtn.addEventListener('click', runCalculation);

    // Dashboard actions
    const reCalcBtn = $('btn-recalculate');
    if (reCalcBtn) reCalcBtn.addEventListener('click', function () {
      state.currentStep = 1;
      updateStepIndicator();
      navigateTo('calculator');
    });

    const viewActionsBtn = $('btn-view-actions');
    if (viewActionsBtn) viewActionsBtn.addEventListener('click', function () { navigateTo('actions'); });

    // Theme toggle
    const themeBtn = $('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Export data
    const exportBtn = $('btn-export');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    // Reset data
    const resetBtn = $('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetData);

    // Modal close — uses extracted closeModal() helper
    const modalCloseBtn = $('modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }

    const modal = $('badge-modal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeModal();
        }
      });
      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeModal();
        }
      });
    }

    // Skip link
    const skipLink = $('skip-link');
    if (skipLink) {
      skipLink.addEventListener('click', function (e) {
        e.preventDefault();
        const main = $('main-content');
        if (main) {
          main.setAttribute('tabindex', '-1');
          main.focus();
        }
      });
    }

    // Keyboard: Escape closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-open');
        if (openModal) {
          closeModal();
        }
      }
    });
  }

  // ─── Initialize ───────────────────────────────────────────────────────────
  /**
   * Initializes the application.
   */
  function init() {
    // Verify module dependencies
    if (typeof CarbonStorage === 'undefined' ||
        typeof CarbonCalculator === 'undefined' ||
        typeof CarbonCharts === 'undefined' ||
        typeof CarbonInsights === 'undefined' ||
        typeof CarbonGamification === 'undefined') {
      console.error('[CarbonApp] Missing required module dependencies. Ensure all scripts are loaded.');
      return;
    }

    // Restore theme preference
    const storedSettings = CarbonStorage.settings();
    if (storedSettings.theme === 'light') {
      document.documentElement.classList.add('light-theme');
      const btn = $('theme-toggle');
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
    const calculations = CarbonStorage.getCalculations();
    if (calculations.length > 0) {
      const lastCalc = calculations[calculations.length - 1];
      // Reconstruct minimal state.lastResult from stored data for dashboard
      if (lastCalc) {
        try {
          const reconstructed = CarbonCalculator.getRating(lastCalc.score || DEFAULT_SCORE);
          state.lastResult = {
            total: lastCalc.total,
            totalTonnes: Math.round((lastCalc.total / 1000) * 100) / 100,
            score: lastCalc.score || DEFAULT_SCORE,
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
            const total = lastCalc.total;
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
