# Phase 13 KYC Test Results

## 1. NIC OCR Parsing Test Matrix

| NIC Input | Expected Format | Expected Year | Expected Gender | Actual Validation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `920452391V` | Old 9-Digit + V | 1992 | MALE | `isValid: true` | ✅ PASS |
| `945451234V` | Old 9-Digit + V | 1994 | FEMALE (Day 545 > 500) | `isValid: true` | ✅ PASS |
| `199204502391` | New 12-Digit | 1992 | MALE | `isValid: true` | ✅ PASS |
| `200154501234` | New 12-Digit | 2001 | FEMALE (Day 545 > 500) | `isValid: true` | ✅ PASS |
| `BADNIC123` | Invalid | N/A | N/A | `isValid: false` | ✅ PASS (Rejected) |
