/**
 * Sri Lankan National Identity Card (NIC) Parser & Validator
 * 
 * Supports:
 * - Old NIC: 9 numeric digits + 'V' or 'X' (e.g. 921450239V)
 * - New NIC: 12 numeric digits (e.g. 199204502391, 200012345678)
 * 
 * Mathematical derivation:
 * - Old format:
 *   - Year: 1900 + first 2 digits (e.g. "92" -> 1992)
 *   - Day of year: digits 3-5 (e.g. "145")
 *   - If day of year > 500 => Female (day = day - 500); else Male
 * - New format:
 *   - Year: first 4 digits (e.g. "1992" -> 1992)
 *   - Day of year: digits 5-7 (e.g. "045")
 *   - If day of year > 500 => Female (day = day - 500); else Male
 */

const DAYS_IN_MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Validates whether string matches Sri Lankan NIC format
 * @param {string} nic 
 * @returns {{ isValid: boolean, format: 'OLD'|'NEW'|null, normalized: string }}
 */
function validateNICFormat(nic) {
  if (!nic || typeof nic !== 'string') {
    return { isValid: false, format: null, normalized: '' };
  }

  const cleaned = nic.trim().toUpperCase().replace(/[\s-]/g, '');

  // Old NIC: 9 digits + V/X
  if (/^[0-9]{9}[VX]$/.test(cleaned)) {
    return { isValid: true, format: 'OLD', normalized: cleaned };
  }

  // New NIC: 12 digits
  if (/^[0-9]{12}$/.test(cleaned)) {
    return { isValid: true, format: 'NEW', normalized: cleaned };
  }

  return { isValid: false, format: null, normalized: cleaned };
}

/**
 * Converts day-of-year into month and day
 * @param {number} dayOfYear 
 * @returns {{ month: number, day: number }|null} (month is 1-indexed)
 */
function getMonthAndDayFromDayOfYear(dayOfYear) {
  if (dayOfYear < 1 || dayOfYear > 366) return null;

  let remainingDays = dayOfYear;
  for (let m = 0; m < DAYS_IN_MONTHS.length; m++) {
    const daysInMonth = DAYS_IN_MONTHS[m];
    if (remainingDays <= daysInMonth) {
      return {
        month: m + 1,
        day: remainingDays
      };
    }
    remainingDays -= daysInMonth;
  }
  return null;
}

/**
 * Extracts demographic data (DOB, Gender) from NIC number
 * @param {string} nic 
 * @returns {{ isValid: boolean, nicNumber: string, format: string, year: number, dob: string, gender: string }|null}
 */
function parseNICDetails(nic) {
  const validation = validateNICFormat(nic);
  if (!validation.isValid) {
    return null;
  }

  const cleaned = validation.normalized;
  let year;
  let days;

  if (validation.format === 'OLD') {
    year = 1900 + parseInt(cleaned.substring(0, 2), 10);
    days = parseInt(cleaned.substring(2, 5), 10);
  } else {
    year = parseInt(cleaned.substring(0, 4), 10);
    days = parseInt(cleaned.substring(4, 7), 10);
  }

  let gender = 'MALE';
  let adjustedDays = days;
  if (days > 500) {
    gender = 'FEMALE';
    adjustedDays = days - 500;
  }

  const monthDay = getMonthAndDayFromDayOfYear(adjustedDays);
  let dobStr = `${year}-01-01`; // Fallback

  if (monthDay) {
    const mm = String(monthDay.month).padStart(2, '0');
    const dd = String(monthDay.day).padStart(2, '0');
    dobStr = `${year}-${mm}-${dd}`;
  }

  return {
    isValid: true,
    nicNumber: cleaned,
    format: validation.format,
    year,
    dob: dobStr,
    gender
  };
}

/**
 * Searches and extracts candidate NIC numbers and metadata from raw OCR text
 * @param {string} ocrText 
 * @returns {{ documentType: string, nicNumber: string|null, extractedName: string|null, dob: string|null, gender: string|null, parsedNIC: object|null }}
 */
function extractFromOCRText(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') {
    return {
      documentType: 'UNKNOWN',
      nicNumber: null,
      extractedName: null,
      dob: null,
      gender: null,
      parsedNIC: null
    };
  }

  const cleanText = ocrText.replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Detect NIC Number candidates via regex
  // Match 9 digits followed by V or X (case insensitive) OR 12 consecutive digits
  const oldNicRegex = /\b([0-9]{9}[vVxX])\b/g;
  const newNicRegex = /\b([0-9]{12})\b/g;

  let detectedNIC = null;

  // Search in full text
  const oldMatches = cleanText.match(oldNicRegex);
  if (oldMatches && oldMatches.length > 0) {
    detectedNIC = oldMatches[0].toUpperCase();
  } else {
    const newMatches = cleanText.match(newNicRegex);
    if (newMatches && newMatches.length > 0) {
      detectedNIC = newMatches[0];
    }
  }

  // Fallback: If spaces or dashes exist inside NIC (e.g. "1992 0450 2391")
  if (!detectedNIC) {
    const spaceRemoved = cleanText.replace(/[\s-]/g, '');
    const altOld = spaceRemoved.match(/([0-9]{9}[vVxX])/);
    if (altOld) {
      detectedNIC = altOld[1].toUpperCase();
    } else {
      const altNew = spaceRemoved.match(/([0-9]{12})/);
      if (altNew) {
        detectedNIC = altNew[1];
      }
    }
  }

  let parsedNIC = null;
  if (detectedNIC) {
    parsedNIC = parseNICDetails(detectedNIC);
  }

  // 2. Extract Candidate Name
  let extractedName = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Check for explicit "Name:" / "Full Name:" markers
    if (upperLine.includes('NAME') || upperLine.includes('NAM E') || upperLine.includes('NAMA')) {
      const parts = line.split(/[:\-\.]/);
      if (parts.length > 1 && parts[1].trim().length > 3) {
        extractedName = parts.slice(1).join(' ').trim();
        break;
      } else if (i + 1 < lines.length && lines[i + 1].length > 3) {
        // Name is on next line
        extractedName = lines[i + 1].trim();
        break;
      }
    }
  }

  // Fallback name extraction: look for alphabetic lines without common headers
  if (!extractedName) {
    const ignoreKeywords = ['SRI LANKA', 'NATIONAL', 'IDENTITY', 'CARD', 'REPUBLIC', 'DEMOCRATIC', 'DEPARTMENT', 'REGISTRATION'];
    for (const line of lines) {
      const upper = line.toUpperCase();
      const isHeader = ignoreKeywords.some(kw => upper.includes(kw));
      const isAlnumOnly = /^[A-Za-z\s\.\,\'\-]+$/.test(line);
      const isLongEnough = line.trim().length >= 5 && line.trim().split(' ').length >= 2;

      if (!isHeader && isAlnumOnly && isLongEnough) {
        extractedName = line.trim();
        break;
      }
    }
  }

  // Normalize extracted name
  if (extractedName) {
    extractedName = extractedName
      .replace(/[^A-Za-z\s\.\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  return {
    documentType: detectedNIC ? 'NIC' : (cleanText.toUpperCase().includes('PASSPORT') ? 'PASSPORT' : 'UNKNOWN'),
    nicNumber: detectedNIC,
    extractedName,
    dob: parsedNIC ? parsedNIC.dob : null,
    gender: parsedNIC ? parsedNIC.gender : null,
    parsedNIC
  };
}

module.exports = {
  validateNICFormat,
  parseNICDetails,
  extractFromOCRText
};
