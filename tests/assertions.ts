import assert from "node:assert/strict";

export function assertExists<T>(value: T, message?: string): asserts value is NonNullable<T> {
  assert(value !== null && value !== undefined, message);
}

export function assertStringIncludes(value: string, substring: string, message?: string): void {
  assert(
    value.includes(substring),
    message ?? `Expected ${JSON.stringify(value)} to include ${JSON.stringify(substring)}`,
  );
}

function assertError<T extends Error>(
  error: unknown,
  expectedType: abstract new (...args: never[]) => T,
  message?: string,
): asserts error is T {
  assert(error instanceof expectedType, `Expected ${expectedType.name}, received ${String(error)}`);
  if (message !== undefined) assertStringIncludes(error.message, message);
}

export function assertThrows<T extends Error>(
  action: () => unknown,
  expectedType: abstract new (...args: never[]) => T,
  message?: string,
): T {
  try {
    action();
  } catch (error) {
    assertError(error, expectedType, message);
    return error;
  }
  assert.fail("Expected action to throw");
}

export async function assertRejects<T extends Error>(
  action: () => Promise<unknown>,
  expectedType: abstract new (...args: never[]) => T,
  message?: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assertError(error, expectedType, message);
    return true;
  });
}
