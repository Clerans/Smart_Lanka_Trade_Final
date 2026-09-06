/**
 * Sri Lankan National Identity Card (NIC) Parser & Validator
 * 
 * Supports:
 * - OLD NIC: 9 numeric digits + 'V' or 'X' (e.g., 921450239V, 856450239X)
 * - NEW NIC: 12 numeric digits (e.g., 199204502391, 200012345678)
 * 
 * Mathematical Demographics Derivation:
 * - OLD format:
 *   - First 2 digits: Birth Year = 1900 + YY
 *   - Next 3 digits: Day of year component (1-366 for Male, 501-866 for Female -> subtract 500)
 * - NEW format:
 *   - First 4 digits: Birth Year = YYYY
 *   - Next 3 digits: Day of year component (1-366 for Male, 501-866 for Female -> subtract 500)
 * 
 * Accurate Leap-Year-Aware Day-to-Date Conversion:
 * - Leap year: (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
 * - Non-leap year February has 28 days (total 365 days); Leap year has 29 days (total 366 days).
 */

const DAYS_IN_MONTHS_NORMAL = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_MONTHS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Checks if a given year is a leap year
 * @param {number} year 
 * @returns {boolean}
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Converts Julian day of year (1-366) to Month and Day for a specific year
 * @param {number} dayOfYear 
 * @param {number} year 
 * @returns {{ month: number, day: number }|null}
 */
function getMonthAndDayFromDayOfYear(dayOfYear, year) {
  const isLeap = isLeapYear(year);
  const maxDays = isLeap ? 366 : 365;

  if (dayOfYear < 1 || dayOfYear > maxDays) {
    return null;
  }

  const monthDays = isLeap ? DAYS_IN_MONTHS_LEAP : DAYS_IN_MONTHS_NORMAL;
  let remainingDays = dayOfYear;

  for (let m = 0; m < monthDays.length; m++) {
    const daysInMonth = monthDays[m];
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
 * Normalizes an NIC input string (uppercased, stripped of whitespace, dashes, dots, and harmless punctuation)
 * @param {string} rawInput 
 * @returns {string}
 */
function normalizeNICString(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  return rawInput
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.:,;/\\|()]/g, '');
}

/**
 * Validates Sri Lankan NIC format strictly
 * @param {string} nic 
 * @returns {{ isValid: boolean, format: 'OLD'|'NEW'|null, normalized: string }}
 */
function validateNICFormat(nic) {
  const normalized = normalizeNICString(nic);
  if (!normalized) {
    return { isValid: false, format: null, normalized: '' };
  }

  // Old NIC: 9 digits + 'V' or 'X'
  if (/^[0-9]{9}[VX]$/.test(normalized)) {
    // Validate day of year range within old NIC
    const days = parseInt(normalized.substring(2, 5), 10);
    const isMale = days >= 1 && days <= 366;
    const isFemale = days >= 501 && days <= 866;
    if (isMale || isFemale) {
      return { isValid: true, format: 'OLD', normalized };
    }
    return { isValid: false, format: null, normalized };
  }

  // New NIC: exactly 12 digits
  if (/^[0-9]{12}$/.test(normalized)) {
    // Validate day of year range within new NIC
    const days = parseInt(normalized.substring(4, 7), 10);
    const isMale = days >= 1 && days <= 366;
    const isFemale = days >= 501 && days <= 866;
    if (isMale || isFemale) {
      return { isValid: true, format: 'NEW', normalized };
    }
    return { isValid: false, format: null, normalized };
  }

  return { isValid: false, format: null, normalized };
}

/**
 * Parses demographic details (DOB, Gender, Year) from a Sri Lankan NIC
 * @param {string} nic 
 * @returns {{ isValid: boolean, nicNumber: string, format: 'OLD'|'NEW', year: number, dob: string, gender: 'MALE'|'FEMALE', documentType: 'NIC' }|null}
 */
function parseNICDetails(nic) {
  const validation = validateNICFormat(nic);
  if (!validation.isValid) {
    return null;
  }

  const cleaned = validation.normalized;
  let year;
  let rawDays;

  if (validation.format === 'OLD') {
    year = 1900 + parseInt(cleaned.substring(0, 2), 10);
    rawDays = parseInt(cleaned.substring(2, 5), 10);
  } else {
    year = parseInt(cleaned.substring(0, 4), 10);
    rawDays = parseInt(cleaned.substring(4, 7), 10);
  }

  let gender = 'MALE';
  let adjustedDays = rawDays;

  if (rawDays > 500) {
    gender = 'FEMALE';
    adjustedDays = rawDays - 500;
  }

  const monthDay = getMonthAndDayFromDayOfYear(adjustedDays, year);
  if (!monthDay) {
    return null;
  }

  const mm = String(monthDay.month).padStart(2, '0');
  const dd = String(monthDay.day).padStart(2, '0');
  const dobStr = `${year}-${mm}-${dd}`;

  return {
    isValid: true,
    nicNumber: cleaned,
    format: validation.format,
    year,
    dob: dobStr,
    gender,
    documentType: 'NIC'
  };
}

/**
 * Normalizes common OCR misrecognitions for potential NIC alphanumeric tokens
 * (e.g., O/o -> 0, I/l -> 1, S/s -> 5, B -> 8, Z -> 2, suffix U/u -> V)
 * @param {string} token 
 * @returns {string}
 */
function fixOCRNICConfusions(token) {
  if (!token) return '';
  let fixed = token.trim().toUpperCase();

  // If ends with U or V/X
  if (fixed.length === 10) {
    let prefix = fixed.substring(0, 9);
    let suffix = fixed.charAt(9);

    prefix = prefix
      .replace(/[O]/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .replace(/[Z]/g, '2');

    if (suffix === 'U') suffix = 'V';

    return prefix + suffix;
  }

  if (fixed.length === 12) {
    return fixed
      .replace(/[O]/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .replace(/[Z]/g, '2');
  }

  return fixed;
}

/**
 * Extracts NIC number, demographic details, and cardholder name from raw OCR text
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

  let detectedNIC = null;
  let parsedNIC = null;

  // 1. Scan for direct regex matches
  const oldNicRegex = /\b([0-9]{9}[vVxX])\b/g;
  const newNicRegex = /\b([0-9]{12})\b/g;

  const oldMatches = cleanText.match(oldNicRegex);
  if (oldMatches && oldMatches.length > 0) {
    for (const match of oldMatches) {
      const parsed = parseNICDetails(match);
      if (parsed) {
        detectedNIC = parsed.nicNumber;
        parsedNIC = parsed;
        break;
      }
    }
  }

  if (!detectedNIC) {
    const newMatches = cleanText.match(newNicRegex);
    if (newMatches && newMatches.length > 0) {
      for (const match of newMatches) {
        const parsed = parseNICDetails(match);
        if (parsed) {
          detectedNIC = parsed.nicNumber;
          parsedNIC = parsed;
          break;
        }
      }
    }
  }

  // 2. Scan line-by-line with OCR confusion correction
  if (!detectedNIC) {
    for (const line of lines) {
      const tokens = line.split(/[\s,;:|/]+/);
      for (const token of tokens) {
        const fixedToken = fixOCRNICConfusions(token);
        const parsed = parseNICDetails(fixedToken);
        if (parsed) {
          detectedNIC = parsed.nicNumber;
          parsedNIC = parsed;
          break;
        }
      }
      if (detectedNIC) break;
    }
  }

  // 3. Scan stripped continuous text for embedded NICs
  if (!detectedNIC) {
    const stripped = cleanText.replace(/[\s\-_.:,;/\\|()]/g, '');
    const altOld = stripped.match(/([0-9]{9}[vVxXuU])/i);
    if (altOld) {
      const fixed = fixOCRNICConfusions(altOld[1]);
      const parsed = parseNICDetails(fixed);
      if (parsed) {
        detectedNIC = parsed.nicNumber;
        parsedNIC = parsed;
      }
    } else {
      const altNew = stripped.match(/([0-9]{12})/);
      if (altNew) {
        const parsed = parseNICDetails(altNew[1]);
        if (parsed) {
          detectedNIC = parsed.nicNumber;
          parsedNIC = parsed;
        }
      }
    }
  }

  // 4. Extract Cardholder Name (Do not fabricate)
  let extractedName = null;
  const nameHeaders = [
    'FULL NAME',
    'NAME IN FULL',
    'NAME',
    'GIVEN NAME',
    'NAM E',
    'SAMPURNA NAMA',
    'NAMA'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    for (const header of nameHeaders) {
      if (upper.startsWith(header) || upper.includes(header + ':') || upper.includes(header + ' -')) {
        const parts = line.split(/[:\-\.]/);
        if (parts.length > 1 && parts[1].trim().length >= 3) {
          extractedName = parts.slice(1).join(' ').trim();
          break;
        } else if (i + 1 < lines.length && lines[i + 1].trim().length >= 3) {
          extractedName = lines[i + 1].trim();
          break;
        }
      }
    }
    if (extractedName) break;
  }

  // If no explicit label, check for candidate alphabetic name lines
  if (!extractedName) {
    const ignoredKeywords = [
      'SRI LANKA', 'NATIONAL', 'IDENTITY', 'CARD', 'REPUBLIC', 'DEMOCRATIC',
      'SOCIALIST', 'DEPARTMENT', 'REGISTRATION', 'PERSONS', 'MINISTRY',
      'OFFICIAL', 'COMMISSION', 'HOLDER', 'SIGNATURE', 'DATE OF ISSUE',
      'DATE OF BIRTH', 'SEX', 'MALE', 'FEMALE', 'ADDRESS', 'DISTRICT'
    ];

    for (const line of lines) {
      const upper = line.toUpperCase();
      const hasIgnored = ignoredKeywords.some(kw => upper.includes(kw));
      const isAlphaLine = /^[A-Za-z\s.\-']+$/.test(line.trim());
      const words = line.trim().split(/\s+/);

      if (!hasIgnored && isAlphaLine && words.length >= 2 && line.trim().length >= 5 && line.trim().length <= 60) {
        extractedName = line.trim();
        break;
      }
    }
  }

  // Clean extracted name or set null if invalid
  if (extractedName) {
    extractedName = extractedName
      .replace(/[^A-Za-z\s.\-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    if (extractedName.length < 3) {
      extractedName = null;
    }
  }

  const documentType = detectedNIC
    ? 'NIC'
    : (cleanText.toUpperCase().includes('PASSPORT') ? 'PASSPORT' : 'UNKNOWN');

  return {
    documentType,
    nicNumber: detectedNIC,
    extractedName: extractedName || null,
    dob: parsedNIC ? parsedNIC.dob : null,
    gender: parsedNIC ? parsedNIC.gender : null,
    parsedNIC
  };
}

module.exports = {
  validateNICFormat,
  parseNICDetails,
  extractFromOCRText,
  isLeapYear,
  normalizeNICString
};
