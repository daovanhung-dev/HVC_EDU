export async function jsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error('VALIDATION_ERROR');
  }
}

export function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('VALIDATION_ERROR');
  return value.trim();
}

export function requiredUuid(value: unknown): string {
  const text = requiredString(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new Error('VALIDATION_ERROR');
  return text;
}

export function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('VALIDATION_ERROR');
  return value;
}
