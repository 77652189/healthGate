const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

export function assertNoDangerousKeys(value: unknown, path: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDangerousKeys(item, [...path, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const key of Object.keys(value)) {
    if (dangerousKeys.has(key)) {
      throw new Error(`Dangerous key "${[...path, key].join(".")}" is not allowed.`);
    }
    assertNoDangerousKeys((value as Record<string, unknown>)[key], [...path, key]);
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

