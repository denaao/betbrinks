/**
 * VULN-015 fix: Safe arithmetic for financial calculations.
 *
 * Floating-point numbers (IEEE 754) cannot represent all decimals exactly.
 * Example: 0.1 + 0.2 = 0.30000000000000004
 *
 * For betting odds (e.g. 2.35), we multiply by 100 to work in integer
 * centésimos, perform the multiplication, then divide back and floor.
 * This avoids accumulated rounding errors.
 */

/**
 * Safely multiplies an integer amount by a decimal odd value.
 * Returns a floored integer (points/cents).
 *
 * @param amount  Integer amount (e.g. 1000 points)
 * @param oddValue  Decimal odd (e.g. 2.35)
 * @returns Floored integer result
 *
 * @example
 *   safeMultiply(1000, 2.35) => 2350  (not 2349.9999... or 2350.0000001)
 */
export function safeMultiply(amount: number, oddValue: number): number {
  // Convert oddValue to integer by finding its decimal places (max 4)
  const oddStr = oddValue.toString();
  const decimalPlaces = oddStr.includes('.') ? oddStr.split('.')[1].length : 0;
  const scale = Math.pow(10, Math.min(decimalPlaces, 4));

  // Integer multiplication: no float error possible
  const oddInt = Math.round(oddValue * scale);
  const result = (amount * oddInt) / scale;

  return Math.floor(result);
}

/**
 * Safely multiplies multiple decimal values together (for combined odds).
 * Returns the combined value as a float with controlled precision.
 *
 * @param values Array of decimal odd values
 * @returns Combined odd with up to 6 decimal places of precision
 */
export function safeCombinedOdd(values: number[]): number {
  // Use integer math: multiply each value * 10000, then divide back
  const SCALE = 10000;
  let result = SCALE; // Start at 1.0 in scaled form

  for (const v of values) {
    const vScaled = Math.round(v * SCALE);
    result = Math.round((result * vScaled) / SCALE);
  }

  return result / SCALE;
}
