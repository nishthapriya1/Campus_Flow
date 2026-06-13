/**
 * Extracts the first date occurrence from a text string.
 * Supports:
 * - ISO 8601 (YYYY-MM-DD)
 * - British/Indian (DD/MM/YYYY)
 * - Textual (DD Month YYYY, e.g., "13 June 2026", "13th of June 2026")
 * @param {string} text - The input text to scan
 * @returns {Date|null} The parsed Date object or null if no match found
 */
export const extractDate = (text) => {
  if (!text) return null;

  // 1. Check for ISO 8601: YYYY-MM-DD
  const isoRegex = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/;
  const isoMatch = text.match(isoRegex);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1; // 0-indexed in JavaScript
    const day = parseInt(isoMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // 2. Check for DD/MM/YYYY or DD-MM-YYYY
  const dmYRegex = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/;
  const dmYMatch = text.match(dmYRegex);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1;
    const year = parseInt(dmYMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // 3. Check for DD Month YYYY (e.g. "13 June 2026", "13th June 2026", "13th of June 2026")
  const monthMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  const textMonthRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b\s+(\d{4})/i;
  const textMonthMatch = text.match(textMonthRegex);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthStr = textMonthMatch[2].toLowerCase();
    const year = parseInt(textMonthMatch[3], 10);
    const month = monthMap[monthStr];
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
};
export default extractDate;
