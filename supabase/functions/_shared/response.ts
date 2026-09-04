export function ok(data: unknown, traceId = crypto.randomUUID()): Response {
  return Response.json({ success: true, data, error: null, traceId });
}

export function fail(status: number, code: string, message: string, details: unknown = null, traceId = crypto.randomUUID()): Response {
  return Response.json({ success: false, data: null, error: { code, message, details }, traceId }, { status });
}
