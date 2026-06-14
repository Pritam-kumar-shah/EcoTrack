/**
 * @fileoverview Secure localStorage manager for Carbon Footprint Platform.
 * Handles data persistence with schema validation, sanitization, and error handling.
 * @version 1.0.0
 */

var CarbonStorage = (function () {
  'use strict';

  /** Storage key prefix to avoid collisions */
  var PREFIX = 'cfp_v1_';

  /** Maximum allowed size for a single storage entry (50 KB) */
  var MAX_ENTRY_SIZE = 50 * 1024;

  /** Schema definitions for each stored entity */
  var SCHEMAS = {
    calculations: {
      type: 'array',
      maxItems: 52, // 1 year of weekly records
    },
    actions: {
      type: 'object',
    },
    badges: {
      type: 'object',
    },
    settings: {
      type: 'object',
      defaults: {
        theme: 'dark',
        unit: 'kg',
        country: 'IN',
        notifications: true,
      },
    },
    profile: {
      type: 'object',
      defaults: {
        name: '',
        joinDate: null,
        totalCalculations: 0,
      },
    },
  };

  /**
   * Sanitizes a string value to prevent XSS.
   * @param {string} str - Input string to sanitize.
   * @returns {string} Sanitized string.
   */
  function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .substring(0, 500); // Max string length
  }

  /**
   * Validates that a value matches expected type.
   * @param {*} value - Value to validate.
   * @param {string} expectedType - Expected type ('object', 'array', 'number', 'string').
   * @returns {boolean} Whether value is valid.
   */
  function validateType(value, expectedType) {
    if (expectedType === 'array') return Array.isArray(value);
    if (expectedType === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
    return typeof value === expectedType;
  }

  /**
   * Sanitizes a deep object, removing any script injection attempts.
   * @param {*} obj - Object to sanitize.
   * @param {number} depth - Current recursion depth.
   * @returns {*} Sanitized object.
   */
  function sanitizeDeep(obj, depth) {
    depth = depth || 0;
    if (depth > 10) return null; // Prevent deep recursion attacks

    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj === 'number') {
      if (!isFinite(obj)) return 0;
      return obj;
    }
    if (typeof obj === 'boolean') return obj;
    if (obj === null || obj === undefined) return null;

    if (Array.isArray(obj)) {
      return obj.slice(0, 1000).map(function (item) {
        return sanitizeDeep(item, depth + 1);
      });
    }

    if (typeof obj === 'object') {
      var clean = {};
      var keys = Object.keys(obj).slice(0, 100); // Max 100 keys
      keys.forEach(function (key) {
        var safeKey = sanitizeString(key);
        if (safeKey) {
          clean[safeKey] = sanitizeDeep(obj[key], depth + 1);
        }
      });
      return clean;
    }

    return null;
  }

  /**
   * Checks if localStorage is available.
   * @returns {boolean} Whether localStorage is available.
   */
  function isStorageAvailable() {
    try {
      var test = '__cfp_test__';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Gets the full storage key with prefix.
   * @param {string} key - Raw key name.
   * @returns {string} Prefixed key.
   */
  function getKey(key) {
    return PREFIX + key;
  }

  /**
   * Saves data to localStorage with validation.
   * @param {string} key - Storage key (must match SCHEMAS).
   * @param {*} data - Data to store.
   * @returns {boolean} Success status.
   */
  function save(key, data) {
    if (!isStorageAvailable()) {
      console.warn('[CarbonStorage] localStorage not available');
      return false;
    }

    var schema = SCHEMAS[key];
    if (!schema) {
      console.warn('[CarbonStorage] Unknown key:', key);
      return false;
    }

    var sanitized = sanitizeDeep(data);

    if (!validateType(sanitized, schema.type)) {
      console.warn('[CarbonStorage] Type mismatch for key:', key);
      return false;
    }

    if (schema.type === 'array' && schema.maxItems) {
      sanitized = sanitized.slice(-schema.maxItems);
    }

    try {
      var serialized = JSON.stringify(sanitized);
      if (serialized.length > MAX_ENTRY_SIZE) {
        console.warn('[CarbonStorage] Data too large for key:', key);
        return false;
      }
      localStorage.setItem(getKey(key), serialized);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Prune old data if quota exceeded
        pruneOldData();
        try {
          localStorage.setItem(getKey(key), JSON.stringify(sanitized));
          return true;
        } catch (e2) {
          console.error('[CarbonStorage] Storage quota exceeded');
          return false;
        }
      }
      console.error('[CarbonStorage] Save error:', e.message);
      return false;
    }
  }

  /**
   * Loads data from localStorage.
   * @param {string} key - Storage key.
   * @returns {*} Stored data or default value.
   */
  function load(key) {
    if (!isStorageAvailable()) return getDefault(key);

    var schema = SCHEMAS[key];
    if (!schema) return null;

    try {
      var raw = localStorage.getItem(getKey(key));
      if (raw === null) return getDefault(key);

      var parsed = JSON.parse(raw);
      var sanitized = sanitizeDeep(parsed);

      if (!validateType(sanitized, schema.type)) {
        console.warn('[CarbonStorage] Corrupted data for key:', key, '- resetting');
        remove(key);
        return getDefault(key);
      }

      return sanitized;
    } catch (e) {
      console.error('[CarbonStorage] Load error for key:', key, e.message);
      remove(key);
      return getDefault(key);
    }
  }

  /**
   * Gets the default value for a schema key.
   * @param {string} key - Schema key.
   * @returns {*} Default value.
   */
  function getDefault(key) {
    var schema = SCHEMAS[key];
    if (!schema) return null;
    if (schema.defaults) return Object.assign({}, schema.defaults);
    if (schema.type === 'array') return [];
    if (schema.type === 'object') return {};
    return null;
  }

  /**
   * Removes a key from storage.
   * @param {string} key - Storage key.
   */
  function remove(key) {
    if (!isStorageAvailable()) return;
    try {
      localStorage.removeItem(getKey(key));
    } catch (e) {
      console.error('[CarbonStorage] Remove error:', e.message);
    }
  }

  /**
   * Saves a calculation record to history.
   * @param {Object} calculation - Calculation result object.
   * @returns {boolean} Success status.
   */
  function saveCalculation(calculation) {
    if (!calculation || typeof calculation.total !== 'number') return false;

    var calculations = load('calculations');
    calculations.push({
      id: Date.now(),
      date: new Date().toISOString(),
      total: Math.round(calculation.total * 100) / 100,
      breakdown: calculation.breakdown || {},
      timestamp: Date.now(),
    });

    return save('calculations', calculations);
  }

  /**
   * Gets all stored calculations.
   * @returns {Array} Array of calculation records.
   */
  function getCalculations() {
    return load('calculations');
  }

  /**
   * Saves an action state (checked/unchecked).
   * @param {string} actionId - Action identifier.
   * @param {boolean} completed - Whether action is completed.
   * @returns {boolean} Success status.
   */
  function saveAction(actionId, completed) {
    var actions = load('actions');
    var safeId = sanitizeString(String(actionId));
    if (safeId) {
      actions[safeId] = Boolean(completed);
    }
    return save('actions', actions);
  }

  /**
   * Gets all saved actions.
   * @returns {Object} Map of actionId to completed state.
   */
  function getActions() {
    return load('actions');
  }

  /**
   * Saves a badge as earned.
   * @param {string} badgeId - Badge identifier.
   * @returns {boolean} Success status.
   */
  function earnBadge(badgeId) {
    var badges = load('badges');
    var safeId = sanitizeString(String(badgeId));
    if (safeId && !badges[safeId]) {
      badges[safeId] = {
        earned: true,
        earnedAt: new Date().toISOString(),
      };
      return save('badges', badges);
    }
    return false;
  }

  /**
   * Gets all earned badges.
   * @returns {Object} Map of badgeId to badge data.
   */
  function getBadges() {
    return load('badges');
  }

  /**
   * Gets or updates user settings.
   * @param {Object|null} updates - Settings to update, or null to just get.
   * @returns {Object} Current settings.
   */
  function settings(updates) {
    var current = load('settings');
    if (updates && typeof updates === 'object') {
      Object.assign(current, sanitizeDeep(updates));
      save('settings', current);
    }
    return current;
  }

  /**
   * Gets or updates user profile.
   * @param {Object|null} updates - Profile updates, or null to just get.
   * @returns {Object} Current profile.
   */
  function profile(updates) {
    var current = load('profile');
    if (!current.joinDate) {
      current.joinDate = new Date().toISOString();
      save('profile', current);
    }
    if (updates && typeof updates === 'object') {
      Object.assign(current, sanitizeDeep(updates));
      save('profile', current);
    }
    return current;
  }

  /**
   * Prunes old calculation records to free space.
   */
  function pruneOldData() {
    var calculations = load('calculations');
    if (calculations.length > 12) {
      save('calculations', calculations.slice(-12));
    }
  }

  /**
   * Clears all app data (with confirmation).
   * @returns {boolean} Success status.
   */
  function clearAll() {
    var keys = Object.keys(SCHEMAS);
    keys.forEach(function (key) {
      remove(key);
    });
    return true;
  }

  /**
   * Exports all data as a JSON object (for user download).
   * @returns {Object} All stored data.
   */
  function exportData() {
    var result = {};
    Object.keys(SCHEMAS).forEach(function (key) {
      result[key] = load(key);
    });
    return result;
  }

  // Public API
  return {
    save: save,
    load: load,
    remove: remove,
    saveCalculation: saveCalculation,
    getCalculations: getCalculations,
    saveAction: saveAction,
    getActions: getActions,
    earnBadge: earnBadge,
    getBadges: getBadges,
    settings: settings,
    profile: profile,
    clearAll: clearAll,
    exportData: exportData,
    isAvailable: isStorageAvailable,
  };
})();
