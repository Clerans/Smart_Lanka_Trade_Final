const nicParser = require('./nicParser');

/**
 * Universal Document Parser for Sri Lankan Identity Documents
 * Supports:
 * - Sri Lankan National Identity Cards (NIC): Old format (9 digits + V/X) and New format (12 digits)
 * - Sri Lankan Driving Licences: Smart card format with Licence Number, NIC, Categories, Dates, Address
 */

/**
 * Normalizes date string into YYYY-MM-DD standard format
 * @param {string} rawDate 
 * @returns {string|null}
 */
function normalizeDateString(rawDate) {
  if (!rawDate || typeof rawDate !== 'string') return null;
  const cleaned = rawDate.trim().replace(/[./]/g, '-');
  
  // Format: YYYY-MM-DD
  const ymdMatch = cleaned.match(/\b(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])\b/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Format: DD-MM-YYYY
  const dmyMatch = cleaned.match(/\b([0-2][0-9]|3[01])-(0[1-9]|1[0-2])-(19\d{2}|20\d{2})\b/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  return null;
}

/**
 * Extracts address from OCR lines
 * @param {string[]} lines 
 * @returns {string|null}
 */
function extractAddressFromLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;

  // 1. Priority 1: Lines containing explicit Sri Lankan address road/city keywords
  const strongAddressKeywords = [
    /\b(?:ROAD|RD|STREET|ST|MAWATHA|MW|LANE|GARDENS|AVENUE|COLOMBO|KANDY|GALLE|GAMPAHA|KURUNEGALA|MATARA|NEGOMBO|JAFFNA|KALUTARA|PUSSELLAWA|NUWARAELIYA)\b/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (strongAddressKeywords.some(kw => kw.test(upper))) {
      if (!upper.includes('DEPARTMENT') && !upper.includes('REPUBLIC') && !upper.includes('MINISTRY') && !upper.includes('COMMISSIONER')) {
        let cleaned = line.replace(/^[^A-Za-z0-9/]+/, '').trim();
        cleaned = cleaned.replace(/^(?:ADDRESS\s*[:\-\.]*\s*|ADDR\s*[:\-\.]*\s*|LIPINAYA\s*[:\-\.]*\s*|8\.\s*|8\s+)/i, '');
        cleaned = cleaned.replace(/NUWARAELIYAROAD/i, 'NUWARAELIYA ROAD');

        // Check if the next line is a city (e.g. PUSSELLAWA) or continuation of address
        const hasCity = /\b(?:PUSSELLAWA|COLOMBO|KANDY|GALLE|GAMPAHA|KURUNEGALA|MATARA|NEGOMBO|JAFFNA|KALUTARA)\b/i.test(cleaned);
        if (!hasCity && i + 1 < lines.length && !lines[i + 1].match(/^[0-9]\./) && lines[i + 1].length > 3) {
          const nextLine = lines[i + 1].trim();
          const nextUpper = nextLine.toUpperCase();
          if (!nextUpper.includes('BLOOD') && !nextUpper.includes('SIGNATURE') && !nextUpper.includes('OFFICIAL') && !nextUpper.includes('COMMISSIONER')) {
            cleaned += ', ' + nextLine;
          }
        }

        // Strip vertical card margin artifact (e.g. "1374/2" -> "374/2")
        cleaned = cleaned.replace(/^[1|I!](?=[1-9]\d{2}\/)/, '');

        // Cut off trailing noise after city name (e.g. "PUSSELLAWA oo" -> "PUSSELLAWA")
        const cityMatch = cleaned.match(/\b(PUSSELLAWA|COLOMBO|KANDY|GALLE|GAMPAHA|KURUNEGALA|MATARA|NEGOMBO|JAFFNA|KALUTARA|BATTICALOA|TRINCOMALEE|RATNAPURA|BADULLA|ANURADHAPURA|POLONNARUWA|NUWARA\s*ELIYA)(?!\s+(?:ROAD|RD|STREET|ST|MAWATHA|MW|LANE|AVENUE|GARDENS))\b(.*)$/i);
        if (cityMatch && cityMatch[2]) {
          const postCity = cityMatch[2].trim();
          if (!/^[0-9]{5}$/.test(postCity)) {
            cleaned = cleaned.substring(0, cityMatch.index + cityMatch[1].length).trim();
          }
        }

        if (cleaned.length >= 8 && cleaned.length <= 120) {
          return cleaned;
        }
      }
    }
  }

  // 2. Priority 2: Lines preceded by Address: header
  const addressHeaders = [
    /^\s*(?:8\.\s*|ADDRESS\s*[:\-\.]*|ADDR\s*[:\-\.]*|RESIDENCE\s*[:\-\.]*|LIPINAYA\s*[:\-\.]*)/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const header of addressHeaders) {
      if (header.test(line)) {
        let cleaned = line.replace(header, '').trim();
        if (i + 1 < lines.length && !lines[i + 1].match(/^[0-9]\./) && lines[i + 1].length > 3) {
          const nextLine = lines[i + 1].trim();
          if (!nextLine.toUpperCase().includes('SIGNATURE') && !nextLine.toUpperCase().includes('OFFICIAL')) {
            cleaned += ', ' + nextLine;
          }
        }
        cleaned = cleaned.replace(/^[^A-Za-z0-9/]+/, '').trim();
        cleaned = cleaned.replace(/^(?:8\.\s*|8\s+)/i, '');
        cleaned = cleaned.replace(/NUWARAELIYAROAD/i, 'NUWARAELIYA ROAD');
        cleaned = cleaned.replace(/^[1|I!](?=[1-9]\d{2}\/)/, '');

        const cityMatch2 = cleaned.match(/\b(PUSSELLAWA|COLOMBO|KANDY|GALLE|GAMPAHA|KURUNEGALA|MATARA|NEGOMBO|JAFFNA|KALUTARA|BATTICALOA|TRINCOMALEE|RATNAPURA|BADULLA|ANURADHAPURA|POLONNARUWA|NUWARA\s*ELIYA)(?!\s+(?:ROAD|RD|STREET|ST|MAWATHA|MW|LANE|AVENUE|GARDENS))\b(.*)$/i);
        if (cityMatch2 && cityMatch2[2]) {
          const postCity = cityMatch2[2].trim();
          if (!/^[0-9]{5}$/.test(postCity)) {
            cleaned = cleaned.substring(0, cityMatch2.index + cityMatch2[1].length).trim();
          }
        }

        if (cleaned.length >= 5) {
          return cleaned;
        }
      }
    }
  }

  return null;
}

/**
 * Parses Sri Lankan Driving Licence details from OCR text
 * @param {string} ocrText 
 * @returns {object}
 */
function extractDrivingLicenceDetails(ocrText) {
  if (!ocrText || typeof ocrText !== 'string') {
    return {
      documentType: 'DRIVING_LICENCE',
      licenceNumber: null,
      nicNumber: null,
      fullName: null,
      dob: null,
      licenceCategory: null,
      issueDate: null,
      expiryDate: null,
      address: null
    };
  }

  const cleanText = ocrText.replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let licenceNumber = null;
  let nicNumber = null;
  let fullName = null;
  let dob = null;
  let licenceCategory = null;
  let issueDate = null;
  let expiryDate = null;

  // 1. Licence Number detection: Field 5 or format B1234567 / B12345678 / A1234567
  const dlField5Regex = /(?:^|\b)(?:5\.\s*|5\s+|DL\s*NO[:\s.-]*|LICENCE\s*NO[:\s.-]*|LICENSE\s*NO[:\s.-]*)([A-Z][0-9]{7,8})\b/i;
  const matchField5 = cleanText.match(dlField5Regex);
  if (matchField5) {
    licenceNumber = matchField5[1].toUpperCase();
  } else {
    // Standalone Licence Number regex: letter B/A/C followed by 7 or 8 digits
    const standaloneDL = cleanText.match(/\b([B|A|C][0-9]{7,8})\b/i);
    if (standaloneDL) {
      licenceNumber = standaloneDL[1].toUpperCase();
    }
  }

  // 2. NIC Number detection (Field 4d or standalone NIC)
  const nicFieldRegex = /(?:4d\.\s*|4d\s+|NIC[:\s.-]*|IDENTITY\s*NO[:\s.-]*)([0-9]{9}[vVxX]|[0-9]{12})\b/i;
  const matchNicField = cleanText.match(nicFieldRegex);
  if (matchNicField) {
    const valid = nicParser.validateNICFormat(matchNicField[1]);
    if (valid.isValid) {
      nicNumber = valid.normalized;
    }
  }

  if (!nicNumber) {
    const nicOldMatch = cleanText.match(/\b([0-9]{9}[vVxX])\b/);
    if (nicOldMatch) {
      const valid = nicParser.validateNICFormat(nicOldMatch[1]);
      if (valid.isValid) nicNumber = valid.normalized;
    }
  }

  if (!nicNumber) {
    const nicNewMatch = cleanText.match(/\b([0-9]{12})\b/);
    if (nicNewMatch) {
      const valid = nicParser.validateNICFormat(nicNewMatch[1]);
      if (valid.isValid) nicNumber = valid.normalized;
    }
  }

  // 3. Name detection: Field 1 & 2 (Surname & Other names) or Name label
  let surname = null;
  let otherNames = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.match(/^(?:1\.\s*|1\s+|SURNAME[:\s.-]*)/i)) {
      surname = line.replace(/^(?:1\.\s*|1\s+|SURNAME[:\s.-]*)/i, '').replace(/[^A-Za-z\s.-]/g, ' ').trim();
    } else if (upper.match(/^(?:2\.\s*|2\s+|OTHER\s*NAMES[:\s.-]*|GIVEN\s*NAMES[:\s.-]*)/i)) {
      otherNames = line.replace(/^(?:2\.\s*|2\s+|OTHER\s*NAMES[:\s.-]*|GIVEN\s*NAMES[:\s.-]*)/i, '').replace(/[^A-Za-z\s.-]/g, ' ').trim();
    } else if (upper.match(/^(?:1[,\s]+2\.\s*|NAME[:\s.-]*)/i)) {
      fullName = line.replace(/^(?:1[,\s]+2\.\s*|NAME[:\s.-]*)/i, '').replace(/[^A-Za-z\s.-]/g, ' ').trim();
    }
  }

  if (!fullName) {
    if (surname && otherNames) {
      fullName = `${surname} ${otherNames}`.replace(/\s+/g, ' ').trim();
    } else if (otherNames) {
      fullName = otherNames;
    } else if (surname) {
      fullName = surname;
    }
  }

  // Clean full name if found
  if (fullName) {
    fullName = fullName.replace(/\s+(?:SL|SI|S1|IS)\b/gi, '').trim();
    fullName = nicParser.cleanAndNormalizeName(fullName) || fullName.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // 4. Date of Birth: Field 3 or derived from NIC
  const dobFieldRegex = /(?:3\.\s*|3\s+|DOB[:\s.-]*|DATE\s*OF\s*BIRTH[:\s.-]*)([0-9]{2,4}[./\-][0-9]{1,2}[./\-][0-9]{2,4})/i;
  const matchDob = cleanText.match(dobFieldRegex);
  if (matchDob) {
    dob = normalizeDateString(matchDob[1]);
  }

  if (!dob && nicNumber) {
    const parsedNic = nicParser.parseNICDetails(nicNumber);
    if (parsedNic) {
      dob = parsedNic.dob;
    }
  }

  // 5. Issue Date: Field 4a
  const issueFieldRegex = /(?:4a\.\s*|4a\s+|ISSUE\s*DATE[:\s.-]*|DATE\s*OF\s*ISSUE[:\s.-]*)([0-9]{2,4}[./\-][0-9]{1,2}[./\-][0-9]{2,4})/i;
  const matchIssue = cleanText.match(issueFieldRegex);
  if (matchIssue) {
    issueDate = normalizeDateString(matchIssue[1]);
  }

  // 6. Expiry Date: Field 4b
  const expiryFieldRegex = /(?:4b\.\s*|4b\s+|EXPIRY\s*DATE[:\s.-]*|DATE\s*OF\s*EXPIRY[:\s.-]*|VALID\s*UNTIL[:\s.-]*)([0-9]{2,4}[./\-][0-9]{1,2}[./\-][0-9]{2,4})/i;
  const matchExpiry = cleanText.match(expiryFieldRegex);
  if (matchExpiry) {
    expiryDate = normalizeDateString(matchExpiry[1]);
  }

  // 7. Vehicle Categories / Class: Field 9 (e.g. A, B, B1, G1)
  const catRegex = /(?:9\.\s*|9\s+|CLASS[:\s.-]*|CATEGORIES[:\s.-]*|CATEGORY[:\s.-]*)\s*([A-Za-z0-9,\s/]+)/i;
  const matchCat = cleanText.match(catRegex);
  if (matchCat) {
    const rawCat = matchCat[1].trim();
    const cleanedCat = rawCat.split(/[\n,]+/).map(c => c.trim().toUpperCase()).filter(c => /^[A-Z][0-9]?$/.test(c));
    if (cleanedCat.length > 0) {
      licenceCategory = cleanedCat.join(', ');
    }
  }

  // 8. Address
  const address = extractAddressFromLines(lines);

  return {
    documentType: 'DRIVING_LICENCE',
    licenceNumber: licenceNumber || null,
    nicNumber: nicNumber || null,
    fullName: fullName || null,
    dob: dob || null,
    licenceCategory: licenceCategory || null,
    issueDate: issueDate || null,
    expiryDate: expiryDate || null,
    address: address || null
  };
}

/**
 * Universal document extractor handling both NIC and Driving Licence,
 * with multi-side merging and source tracking.
 * 
 * @param {string} frontText - OCR text from Front side
 * @param {string|null} backText - OCR text from Back side (optional)
 * @param {string} requestedDocType - 'NIC' | 'DRIVING_LICENCE' | 'AUTO'
 * @returns {object}
 */
function extractIdentityDocument(frontText = '', backText = '', requestedDocType = 'NIC') {
  const frontClean = (frontText || '').trim();
  const backClean = (backText || '').trim();
  const combinedText = backClean ? `${frontClean}\n--- BACK SIDE ---\n${backClean}` : frontClean;

  const isDLRequested = requestedDocType === 'DRIVING_LICENCE';
  const hasDLMarkers = /DRIVING\s*LICEN[CS]E|MOTOR\s*TRAFFIC/i.test(combinedText);
  const effectiveDocType = isDLRequested || (requestedDocType === 'AUTO' && hasDLMarkers)
    ? 'DRIVING_LICENCE'
    : 'NIC';

  const fieldSources = {};

  if (effectiveDocType === 'DRIVING_LICENCE') {
    // Parse Driving Licence details
    const dlFront = extractDrivingLicenceDetails(frontClean);
    const dlBack = backClean ? extractDrivingLicenceDetails(backClean) : null;

    const licenceNumber = dlFront.licenceNumber || dlBack?.licenceNumber || null;
    const nicNumber = dlFront.nicNumber || dlBack?.nicNumber || null;
    const fullName = dlFront.fullName || dlBack?.fullName || null;
    const dob = dlFront.dob || dlBack?.dob || null;
    const licenceCategory = dlFront.licenceCategory || dlBack?.licenceCategory || null;
    const issueDate = dlFront.issueDate || dlBack?.issueDate || null;
    const expiryDate = dlFront.expiryDate || dlBack?.expiryDate || null;
    const address = dlFront.address || dlBack?.address || null;

    if (licenceNumber) fieldSources.documentNumber = dlFront.licenceNumber ? 'front' : 'back';
    if (nicNumber) fieldSources.nicNumber = dlFront.nicNumber ? 'front' : 'back';
    if (fullName) fieldSources.fullName = dlFront.fullName ? 'front' : 'back';
    if (dob) fieldSources.dob = dlFront.dob ? 'front' : (dlBack?.dob ? 'back' : 'derived');
    if (licenceCategory) fieldSources.licenceCategory = dlFront.licenceCategory ? 'front' : 'back';
    if (issueDate) fieldSources.issueDate = dlFront.issueDate ? 'front' : 'back';
    if (expiryDate) fieldSources.expiryDate = dlFront.expiryDate ? 'front' : 'back';
    if (address) fieldSources.address = dlFront.address ? 'front' : 'back';

    return {
      documentType: 'DRIVING_LICENCE',
      documentNumber: licenceNumber,
      rawOcrText: combinedText,
      extractedFields: {
        documentNumber: licenceNumber,
        licenceNumber,
        fullName,
        dob,
        nicNumber,
        licenceCategory,
        issueDate,
        expiryDate,
        address
      },
      fieldSources
    };
  } else {
    // Parse Sri Lankan NIC
    const frontExt = nicParser.extractFromOCRText(frontClean);
    const backExt = backClean ? nicParser.extractFromOCRText(backClean) : null;

    // Front lines and back lines for address extraction
    const frontLines = frontClean.split('\n').map(l => l.trim()).filter(Boolean);
    const backLines = backClean.split('\n').map(l => l.trim()).filter(Boolean);
    const frontAddress = extractAddressFromLines(frontLines);
    const backAddress = extractAddressFromLines(backLines);

    // Merge NIC Number: Front takes precedence, fallback to back
    const nicNumber = frontExt.nicNumber || backExt?.nicNumber || null;
    if (nicNumber) {
      fieldSources.documentNumber = frontExt.nicNumber ? 'front' : 'back';
      fieldSources.nicNumber = fieldSources.documentNumber;
    }

    // Mathematical parsing of demographics from valid NIC
    let parsedNIC = null;
    if (nicNumber) {
      parsedNIC = nicParser.parseNICDetails(nicNumber);
    }

    // Name: For Old NICs, cardholder full name is almost always on the BACK!
    // For New Smart NICs, full name is on the FRONT.
    let fullName = null;
    if (frontExt.parsedNIC?.format === 'OLD' && backExt?.extractedName) {
      fullName = backExt.extractedName;
      fieldSources.fullName = 'back';
    } else if (frontExt.extractedName) {
      fullName = frontExt.extractedName;
      fieldSources.fullName = 'front';
    } else if (backExt?.extractedName) {
      fullName = backExt.extractedName;
      fieldSources.fullName = 'back';
    }

    // Date of Birth & Gender: derived from NIC or extracted
    const dob = parsedNIC ? parsedNIC.dob : (frontExt.dob || backExt?.dob || null);
    const gender = parsedNIC ? parsedNIC.gender : (frontExt.gender || backExt?.gender || null);
    if (dob) fieldSources.dob = parsedNIC ? 'derived' : (frontExt.dob ? 'front' : 'back');
    if (gender) fieldSources.gender = parsedNIC ? 'derived' : (frontExt.gender ? 'front' : 'back');

    // Address: Back side takes precedence for address on both Old and New NIC
    const address = backAddress || frontAddress || null;
    if (address) {
      fieldSources.address = backAddress ? 'back' : 'front';
    }

    return {
      documentType: 'NIC',
      documentNumber: nicNumber,
      format: parsedNIC ? parsedNIC.format : (frontExt.parsedNIC?.format || null),
      rawOcrText: combinedText,
      extractedFields: {
        documentNumber: nicNumber,
        nicNumber,
        fullName,
        dob,
        gender,
        address,
        licenceCategory: null,
        issueDate: null,
        expiryDate: null
      },
      fieldSources
    };
  }
}

module.exports = {
  extractIdentityDocument,
  extractDrivingLicenceDetails,
  extractAddressFromLines,
  normalizeDateString
};
