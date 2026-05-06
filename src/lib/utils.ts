/**
 * Bulletproof date parser for Firestore Timestamps (raw or serialized)
 */
export function parseDate(val: any): Date {
  if (!val) return new Date();
  
  // 1. Raw Firestore Timestamp
  if (typeof val.toDate === 'function') {
    return val.toDate();
  }
  
  // 2. Serialized Firestore Timestamp ({ seconds, nanoseconds })
  if (val && typeof val === 'object' && 'seconds' in val) {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
  }
  
  // 3. Real Date object
  if (val instanceof Date) {
    return val;
  }
  
  // 4. ISO string or epoch number
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Recursive sanitizer to ensure no raw Firestore Timestamps leak into serializable state.
 * Converts all Timestamps to ISO strings.
 */
export function sanitize<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    // Check if it's a Firestore Timestamp
    if (typeof (data as any).toDate === 'function') {
      return (data as any).toDate().toISOString() as unknown as T;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitize(value);
    }
    return result as T;
  }

  return data;
}
