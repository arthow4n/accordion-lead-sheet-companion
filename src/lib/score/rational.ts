import type { RationalDuration } from "../../types/score.ts";

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

/** Create a reduced rational duration with a positive denominator. */
export function rational(numerator: number, denominator = 1): RationalDuration {
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (denominator === 0) throw new RangeError("denominator must not be zero");
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (sign * numerator) / divisor,
    denominator: (sign * denominator) / divisor,
  };
}

export const RATIONAL_ZERO: RationalDuration = Object.freeze(rational(0));

export function addRational(a: RationalDuration, b: RationalDuration): RationalDuration {
  return rational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function subtractRational(a: RationalDuration, b: RationalDuration): RationalDuration {
  return addRational(a, rational(-b.numerator, b.denominator));
}

export function multiplyRational(a: RationalDuration, scalar: number): RationalDuration {
  assertSafeInteger(scalar, "scalar");
  return rational(a.numerator * scalar, a.denominator);
}

export function compareRational(a: RationalDuration, b: RationalDuration): number {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference === 0 ? 0 : difference < 0 ? -1 : 1;
}

export function rationalToNumber(value: RationalDuration): number {
  return value.numerator / value.denominator;
}

export function isZeroRational(value: RationalDuration): boolean {
  return value.numerator === 0;
}

export function maxRational(a: RationalDuration, b: RationalDuration): RationalDuration {
  return compareRational(a, b) >= 0 ? a : b;
}
