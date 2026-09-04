export function ok(data: unknown, traceId: string = crypto.randomUUID(), status = 200): Response {
  return Response.json({ success: true, data, error: null, traceId }, { status });
}

export function fail(status: number, code: string, message: string, details: unknown = null, traceId: string = crypto.randomUUID()): Response {
  return Response.json({ success: false, data: null, error: { code, message, details }, traceId }, { status });
}

export function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get('origin') ?? '';
  const allowed = new Set([
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://daovanhung.github.io',
  ]);
  const headers = new Headers(response.headers);
  if (allowed.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, x-idempotency-key');
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  return new Response(response.body, { status: response.status, headers });
}

export function preflight(request: Request): Response {
  return withCors(new Response(null, { status: 204 }), request);
}
