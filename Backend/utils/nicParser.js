/**
 * Sri Lankan National Identity Card (NIC) Parser & Validator
 * 
 * Supports:
 * - OLD NIC: 9 numeric digits + 'V' or 'X' (e.g., 921450239V, 856450239X)
 * - NEW NIC: 12 numeric digits (e.g., 199204502391, 200012345678, 200024103235)
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
 * Cleans, removes field labels, and normalizes cardholder name extracted from OCR
 * @param {string} rawName 
 * @returns {string|null}
 */
function cleanAndNormalizeName(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;

  let cleaned = rawName.toUpperCase();

  // Strip leading non-alphanumeric noise/bullets (e.g. '; - ', '- ', '* ', '> ', '~ ')
  cleaned = cleaned.replace(/^[^A-Z0-9]+/, '');

  // Strip leading labels and prefixes (case-insensitive)
  const labelPatterns = [
    /^\s*(?:FULL\s*NAME|NAME\s*IN\s*FULL|GIVEN\s*NAME|SAMPURNA\s*NAMA|NAM\s*E|NAME|NAMA)\s*[:\-\.]*\s*/i,
    /^\s*(?:NIC\s*NO|NIC\s*NUMBER|IDENTITY\s*NO|CARD\s*NO|DOC\s*NO|NO)\s*[:\-\.]*\s*/i,
    /^\s*(?:DATE\s*OF\s*BIRTH|DOB|BIRTH\s*DATE)\s*[:\-\.]*\s*/i,
    /^\s*(?:SEX|GENDER)\s*[:\-\.]*\s*/i
  ];

  for (const pattern of labelPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove trailing field labels if stuck to name (e.g. "MICHAEL CLERANS NIC NO 2000...")
  cleaned = cleaned.replace(/\s+\b(?:NIC|DOB|SEX|GENDER|NO)\b.*$/i, '');

  // Keep only alphabetic characters, spaces, dots, hyphens
  cleaned = cleaned.replace(/[^A-Z\s.\-]/g, ' ');

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Strip trailing single isolated letters (e.g. from stray punctuation, brackets, or bullets)
  cleaned = cleaned.replace(/\s+[A-Z]\b$/i, '').trim();

  // Filter out system header keywords and phrases
  const ignoredPhrases = [
    'SRI LANKA', 'NATIONAL IDENTITY', 'IDENTITY CARD', 'REPUBLIC',
    'DEMOCRATIC', 'SOCIALIST', 'DEPARTMENT', 'REGISTRATION OF PERSONS',
    'REGISTRATION', 'PERSONS', 'MINISTRY', 'OFFICIAL', 'COMMISSION',
    'HOLDER', 'SIGNATURE', 'MALE', 'FEMALE', 'DATE OF BIRTH', 'DATE OF ISSUE'
  ];

  for (const phrase of ignoredPhrases) {
    if (cleaned.includes(phrase)) {
      return null;
    }
  }

  if (cleaned.length < 3) {
    return null;
  }

  return cleaned;
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

  // 4. Extract Cardholder Name (Do not fabricate, clean labels)
  let extractedName = null;
  let hasExplicitNameLabel = false;
  const nameHeaders = [
    'FULL NAME',
    'NAME IN FULL',
    'GIVEN NAME',
    'NAM E',
    'SAMPURNA NAMA',
    'NAMA',
    'NAME'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    for (const header of nameHeaders) {
      if (upper.startsWith(header) || upper.includes(header + ':') || upper.includes(header + ' -') || upper.includes(header + ' ')) {
        // Line contains name marker
        const candidate = cleanAndNormalizeName(line);
        if (candidate) {
          extractedName = candidate;
          hasExplicitNameLabel = true;
          break;
        } else if (i + 1 < lines.length) {
          // Check next line
          const nextCandidate = cleanAndNormalizeName(lines[i + 1]);
          if (nextCandidate) {
            extractedName = nextCandidate;
            hasExplicitNameLabel = true;
            break;
          }
        }
      }
    }
    if (extractedName) break;
  }

  // If no explicit label matched, check for candidate alphabetic name lines
  if (!extractedName) {
    for (const line of lines) {
      const candidate = cleanAndNormalizeName(line);
      if (candidate && candidate.length >= 5 && candidate.length <= 60) {
        const words = candidate.split(/\s+/).filter(w => w.length > 0);
        if (words.length >= 2) {
          const longWords = words.filter(w => w.length >= 3);
          const avgLen = words.reduce((acc, w) => acc + w.length, 0) / words.length;
          // Must have at least one word >= 3 letters and avg length >= 2.5 to avoid single-letter noise
          if (longWords.length >= 1 && avgLen >= 2.5) {
            extractedName = candidate;
            break;
          }
        }
      }
    }
  }

  const documentType = detectedNIC
    ? 'NIC'
    : (cleanText.toUpperCase().includes('PASSPORT') ? 'PASSPORT' : 'UNKNOWN');

  return {
    documentType,
    nicNumber: detectedNIC,
    extractedName: extractedName || null,
    hasExplicitNameLabel,
    dob: parsedNIC ? parsedNIC.dob : null,
    gender: parsedNIC ? parsedNIC.gender : null,
    parsedNIC
  };
}

module.exports = {
  validateNICFormat,
  parseNICDetails,
  extractFromOCRText,
  cleanAndNormalizeName,
  isLeapYear,
  normalizeNICString
};
