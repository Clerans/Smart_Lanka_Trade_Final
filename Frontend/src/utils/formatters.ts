/**
 * Safe currency and number formatting utilities
 */
export function formatLKR(val: number | string | undefined | null, decimals: number = 2): string {
  if (val === undefined || val === null || val === '') {
    return '0.00';
  }
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(
  val: number | string | undefined | null,
  maxDecimals: number = 0,
  minDecimals: number = 0
): string {
  if (val === undefined || val === null || val === '') {
    return minDecimals > 0 ? (0).toFixed(minDecimals) : '0';
  }
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(num)) {
    return minDecimals > 0 ? (0).toFixed(minDecimals) : '0';
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}
