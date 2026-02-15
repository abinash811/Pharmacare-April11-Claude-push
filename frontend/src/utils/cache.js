/**
 * Browser Caching Utility for PharmaCare
 * Caches static data like categories, suppliers, brands in localStorage
 */

const CACHE_PREFIX = 'pharmacare_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL

// Cache configuration for different data types
const CACHE_CONFIG = {
  categories: { ttl: 30 * 60 * 1000 }, // 30 minutes
  suppliers: { ttl: 10 * 60 * 1000 },  // 10 minutes
  brands: { ttl: 30 * 60 * 1000 },     // 30 minutes
  doctors: { ttl: 10 * 60 * 1000 },    // 10 minutes
  settings: { ttl: 5 * 60 * 1000 },    // 5 minutes
  filterOptions: { ttl: 10 * 60 * 1000 }, // 10 minutes
};

/**
 * Get item from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/not found
 */
export const getFromCache = (key) => {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const { data, expiry } = JSON.parse(cached);
    
    if (Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
};

/**
 * Set item in cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds (optional)
 */
export const setInCache = (key, data, ttl) => {
  try {
    const config = CACHE_CONFIG[key] || {};
    const expiry = Date.now() + (ttl || config.ttl || DEFAULT_TTL);
    
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry }));
  } catch (error) {
    console.warn('Cache write error:', error);
    // If localStorage is full, clear old cache entries
    if (error.name === 'QuotaExceededError') {
      clearExpiredCache();
    }
  }
};

/**
 * Remove item from cache
 * @param {string} key - Cache key
 */
export const removeFromCache = (key) => {
  localStorage.removeItem(CACHE_PREFIX + key);
};

/**
 * Clear all cache entries
 */
export const clearCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
};

/**
 * Clear only expired cache entries
 */
export const clearExpiredCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { expiry } = JSON.parse(cached);
          if (Date.now() > expiry) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
  });
};

/**
 * Invalidate cache for a specific key (force refresh on next fetch)
 * @param {string} key - Cache key to invalidate
 */
export const invalidateCache = (key) => {
  removeFromCache(key);
};

/**
 * Fetch with cache - wrapper for API calls
 * @param {string} cacheKey - Cache key
 * @param {Function} fetchFn - Async function that fetches data
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<any>} Cached or fresh data
 */
export const fetchWithCache = async (cacheKey, fetchFn, forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const data = await fetchFn();
  setInCache(cacheKey, data);
  return data;
};

export default {
  get: getFromCache,
  set: setInCache,
  remove: removeFromCache,
  clear: clearCache,
  clearExpired: clearExpiredCache,
  invalidate: invalidateCache,
  fetchWithCache,
};
