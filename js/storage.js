/**
 * @fileoverview Secure localStorage manager for Carbon Footprint Platform.
 * Handles data persistence with schema validation, sanitization, and error handling.
 * @version 2.0.0
 */

/**
 * @typedef {Object} CalculationData
 * @property {number} id - Unique identifier (timestamp-based).
 * @property {string} date - ISO 8601 date string of when the calculation was recorded.
 * @property {number} total - Total carbon footprint value, rounded to 2 decimals.
 * @property {Object<string, number>} breakdown - Category-level breakdown (e.g. { transport: 12.5, energy: 8.3 }).
 * @property {number} timestamp - Unix timestamp in milliseconds.
 */

/**
 * @typedef {Object} ProfileData
 * @property {string} name - User display name.
 * @property {string|null} joinDate - ISO 8601 date string of account creation, or null if unset.
 * @property {number} totalCalculations - Lifetime count of calculations performed.
 */

/**
 * @typedef {Object} SettingsData
 * @property {string} theme - UI theme ('dark' | 'light').
 * @property {string} unit - Measurement unit ('kg' | 'lb').
 * @property {string} country - ISO 3166-1 alpha-2 country code.
 * @property {boolean} notifications - Whether push/in-app notifications are enabled.
 */

const CarbonStorage = (function () {
  'use strict';

  /** Storage key prefix to avoid collisions */
  const PREFIX = 'cfp_v1_';

  /** Maximum allowed size for a single storage entry (50 KB) */
  const MAX_ENTRY_SIZE = 50 * 1024;

  /** Maximum recursion depth for sanitizeDeep */
  const MAX_SANITIZE_DEPTH = 10;

  /** Maximum number of object keys allowed after sanitization */
  const MAX_OBJECT_KEYS = 100;

  /** Maximum number of array items allowed after sanitization */
  const MAX_ARRAY_ITEMS = 1000;

  /** Maximum string length after sanitization */
  const MAX_STRING_LENGTH = 500;

  /** Cached result of the localStorage availability probe */
  let storageAvailableCache = null;

  /** Schema definitions for each stored entity */
  const SCHEMAS = {
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
   * Properties that must never be merged from untrusted input
   * to prevent prototype pollution.
   * @type {ReadonlySet<string>}
   */
  const BANNED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  /**
   * Shallow-merges `source` into `target`, skipping keys that could
   * cause prototype pollution.
   * @param {Object} target - Object to merge into (mutated in place).
   * @param {Object} source - Sanitized source object.
   * @returns {Object} The mutated `target`.
   */
  function safeMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!BANNED_KEYS.has(key)) {
        target[key] = source[key];
      }
    }
    return target;
  }

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
      .substring(0, MAX_STRING_LENGTH);
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
   * @param {number} [depth=0] - Current recursion depth.
   * @returns {*} Sanitized object.
   */
  function sanitizeDeep(obj, depth) {
    const currentDepth = depth || 0;
    if (currentDepth > MAX_SANITIZE_DEPTH) return null; // Prevent deep recursion attacks

    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj === 'number') {
      if (!isFinite(obj)) return 0;
      return obj;
    }
    if (typeof obj === 'boolean') return obj;
    if (obj === null || obj === undefined) return null;

    if (Array.isArray(obj)) {
      return obj.slice(0, MAX_ARRAY_ITEMS).map(function (item) {
        return sanitizeDeep(item, currentDepth + 1);
      });
    }

    if (typeof obj === 'object') {
      const clean = Object.create(null);
      const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (BANNED_KEYS.has(key)) continue;
        const safeKey = sanitizeString(key);
        if (safeKey) {
          clean[safeKey] = sanitizeDeep(obj[key], currentDepth + 1);
        }
      }
      return clean;
    }

    return null;
  }

  /**
   * Checks if localStorage is available. The result is cached after
   * the first successful probe so subsequent calls avoid redundant I/O.
   * @returns {boolean} Whether localStorage is available.
   */
  function isStorageAvailable() {
    if (storageAvailableCache !== null) return storageAvailableCache;

    try {
      const testKey = '__cfp_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      storageAvailableCache = true;
    } catch (e) {
      storageAvailableCache = false;
    }
    return storageAvailableCache;
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
      return false;
    }

    const schema = SCHEMAS[key];
    if (!schema) {
      return false;
    }

    let sanitized = sanitizeDeep(data);

    if (!validateType(sanitized, schema.type)) {
      return false;
    }

    if (schema.type === 'array' && schema.maxItems) {
      sanitized = sanitized.slice(-schema.maxItems);
    }

    try {
      const serialized = JSON.stringify(sanitized);
      if (serialized.length > MAX_ENTRY_SIZE) {
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
        } catch (_retryError) {
          return false;
        }
      }
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

    const schema = SCHEMAS[key];
    if (!schema) return null;

    try {
      const raw = localStorage.getItem(getKey(key));
      if (raw === null) return getDefault(key);

      const parsed = JSON.parse(raw);
      const sanitized = sanitizeDeep(parsed);

      if (!validateType(sanitized, schema.type)) {
        remove(key);
        return getDefault(key);
      }

      return sanitized;
    } catch (e) {
      remove(key);
      return getDefault(key);
    }
  }

  /**
   * Gets the default value for a schema key.
   * Uses safeMerge instead of Object.assign to prevent prototype pollution.
   * @param {string} key - Schema key.
   * @returns {*} Default value.
   */
  function getDefault(key) {
    const schema = SCHEMAS[key];
    if (!schema) return null;
    if (schema.defaults) return safeMerge({}, schema.defaults);
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
    } catch (_e) {
      // Removal failed — silently ignore; nothing useful to surface.
    }
  }

  /**
   * Validates that a breakdown object contains only string keys mapping to
   * finite numbers. Returns a clean copy or an empty object.
   * @param {*} breakdown - Raw breakdown value.
   * @returns {Object<string, number>} Validated breakdown.
   */
  function validateBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) {
      return {};
    }
    const clean = {};
    const keys = Object.keys(breakdown);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (BANNED_KEYS.has(key)) continue;
      const value = breakdown[key];
      if (typeof value === 'number' && isFinite(value)) {
        clean[sanitizeString(key)] = value;
      }
    }
    return clean;
  }

  /**
   * Saves a calculation record to history.
   * @param {Object} calculation - Calculation result object.
   * @param {number} calculation.total - Total carbon footprint value.
   * @param {Object<string, number>} [calculation.breakdown] - Category breakdown.
   * @returns {boolean} Success status.
   */
  function saveCalculation(calculation) {
    if (!calculation || typeof calculation.total !== 'number' || !isFinite(calculation.total)) {
      return false;
    }

    const now = Date.now();
    const calculations = load('calculations');
    calculations.push({
      id: now,
      date: new Date().toISOString(),
      total: Math.round(calculation.total * 100) / 100,
      breakdown: validateBreakdown(calculation.breakdown),
      timestamp: now,
    });

    return save('calculations', calculations);
  }

  /**
   * Gets all stored calculations.
   * @returns {CalculationData[]} Array of calculation records.
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
    if (actionId == null) return false;
    const actions = load('actions');
    const safeId = sanitizeString(String(actionId));
    if (safeId) {
      actions[safeId] = Boolean(completed);
    }
    return save('actions', actions);
  }

  /**
   * Gets all saved actions.
   * @returns {Object<string, boolean>} Map of actionId to completed state.
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
    if (badgeId == null) return false;
    const badges = load('badges');
    const safeId = sanitizeString(String(badgeId));
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
   * @param {SettingsData|null} updates - Settings to update, or null to just get.
   * @returns {SettingsData} Current settings.
   */
  function settings(updates) {
    const current = load('settings');
    if (updates && typeof updates === 'object') {
      safeMerge(current, sanitizeDeep(updates));
      save('settings', current);
    }
    return current;
  }

  /**
   * Gets or updates user profile.
   * @param {ProfileData|null} updates - Profile updates, or null to just get.
   * @returns {ProfileData} Current profile.
   */
  function profile(updates) {
    const current = load('profile');
    if (!current.joinDate) {
      current.joinDate = new Date().toISOString();
      save('profile', current);
    }
    if (updates && typeof updates === 'object') {
      safeMerge(current, sanitizeDeep(updates));
      save('profile', current);
    }
    return current;
  }

  /**
   * Prunes old calculation records to free space.
   */
  function pruneOldData() {
    const calculations = load('calculations');
    if (calculations.length > 12) {
      save('calculations', calculations.slice(-12));
    }
  }

  /**
   * Clears all app data (with confirmation).
   * @returns {boolean} Success status.
   */
  function clearAll() {
    const keys = Object.keys(SCHEMAS);
    for (let i = 0; i < keys.length; i++) {
      remove(keys[i]);
    }
    return true;
  }

  /**
   * Exports all data as a JSON object (for user download).
   * @returns {Object} All stored data.
   */
  function exportData() {
    const result = {};
    const keys = Object.keys(SCHEMAS);
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = load(keys[i]);
    }
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
