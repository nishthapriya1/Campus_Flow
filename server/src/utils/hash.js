import crypto from 'crypto';

/**
 * Stable stringify that handles objects by sorting keys, formatting dates consistently,
 * and calling toJSON on mongoose documents to obtain deterministic content.
 */
const stableStringify = (val) => {
  if (val === null || val === undefined) {
    return '';
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return '[' + val.map(stableStringify).join(',') + ']';
  }
  if (typeof val === 'object') {
    // If it's a Mongoose query result or document with toJSON
    if (typeof val.toJSON === 'function') {
      return stableStringify(val.toJSON());
    }
    // Handle standard objects by sorting their keys
    const keys = Object.keys(val).sort();
    const parts = keys.map(k => `${k}:${stableStringify(val[k])}`);
    return '{' + parts.join(',') + '}';
  }
  return String(val);
};

/**
 * Computes the stable SHA256 hash of any JavaScript variable.
 * @param {*} val - Value to hash
 * @returns {string} SHA256 hex string
 */
export const computeHash = (val) => {
  const cleanString = stableStringify(val);
  return crypto.createHash('sha256').update(cleanString).digest('hex');
};
