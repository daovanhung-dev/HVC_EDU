import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = { import_job_id?: string; file_name?: string; file_base64?: string; storage_path?: string; mode?: 'VALIDATE' | 'IMPORT' | 'RECONCILE' };
type NormalizedPayload = { classes: unknown[]; staff: unknown[]; students: unknown[] };

function normalize(value: unknown): string { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function cell(row: Record<string, unknown>, aliases: string[]): unknown { const keys = Object.keys(row); const wanted = aliases.map(normalize); const key = keys.find((item) => wanted.includes(normalize(item))); return key ? row[key] : null; }
function textCell(row: Record<string, unknown>, aliases: string[]): string { return String(cell(row, aliases) ?? '').trim(); }
function integerCell(row: Record<string, unknown>, aliases: string[]): number | null { const raw = cell(row, aliases); if (raw === null || raw === undefined || String(raw).trim() === '') return null; const parsed = Number(String(raw).replace(/[^0-9-]/g, '')); return Number.isSafeInteger(parsed) ? parsed : null; }
function dateCell(row: Record<string, unknown>, aliases: string[]): string | null { const raw = textCell(row, aliases); if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null; }
function rowsFor(XLSX: any, sheet: any): Record<string, unknown>[] { return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, unknown>[]; }

function normalizeWorkbook(XLSX: any, workbook: any): { payload: NormalizedPayload; issues: Array<{ severity: 'ERROR' | 'WARNING'; sheet_name: string; code: string; message: string; raw_data?: unknown }>; summaries: unknown[] } {
  const issues: Array<{ severity: 'ERROR' | 'WARNING'; sheet_name: string; code: string; message: string; raw_data?: unknown }> = [];
  const classes: unknown[] = [];
  const staff: unknown[] = [];
  const students: unknown[] = [];
  const summaries = workbook.SheetNames.map((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
    const sample = rawRows.slice(0, 4);
    if (rawRows.some((row) => row.some((value) => String(value ?? '').includes('#REF!')))) issues.push({ severity: 'ERROR', sheet_name: sheetName, code: 'REF_ERROR', message: 'Phát hiện #REF!; cần xử lý thủ công, không tự đổi thành 0' });
    const key = normalize(sheetName);
    const records = rowsFor(XLSX, sheet);
    if (key.includes('DANHMUCLOP') || key.includes('DANHSACHLOP')) {
      for (const row of records) {
        const code = textCell(row, ['MA LOP', 'MALOP', 'CODE']);
        const name = textCell(row, ['TEN LOP', 'TENLOP', 'NAME']);
        if (!code && !name) continue;
        if (!code || !name) { issues.push({ severity: 'ERROR', sheet_name: sheetName, code: 'CLASS_REQUIRED_FIELDS', message: 'Lớp thiếu mã hoặc tên' }); continue; }
        const methodRaw = normalize(cell(row, ['CACH THU', 'COLLECTION METHOD']));
        classes.push({ code, name, grade: integerCell(row, ['KHOI', 'GRADE']) ?? 1, subject: textCell(row, ['MON', 'SUBJECT']) || 'Toán', standard_unit_fee: integerCell(row, ['HOC PHI', 'DON GIA', 'PHI BUOI', 'STANDARD UNIT FEE']) ?? 0, collection_method: methodRaw.includes('PREPAID') || methodRaw.includes('THUTRUOC') ? 'PREPAID' : 'PER_SESSION', note: textCell(row, ['GHI CHU', 'NOTE']) || null });
      }
    } else if (key.includes('GIANGVIEN') || key.includes('STAFF')) {
      for (const row of records) {
        const code = textCell(row, ['MA', 'MA GV', 'MAGV', 'CODE']);
        const fullName = textCell(row, ['HO TEN', 'HOTEN', 'TEN', 'FULL NAME', 'NAME']);
        if (!code && !fullName) continue;
        if (!code || !fullName) { issues.push({ severity: 'ERROR', sheet_name: sheetName, code: 'STAFF_REQUIRED_FIELDS', message: 'Nhân sự thiếu mã hoặc họ tên' }); continue; }
        const typeRaw = normalize(cell(row, ['LOAI', 'TYPE', 'STAFF TYPE']));
        staff.push({ code, full_name: fullName, staff_type: typeRaw.includes('TROGIANG') || typeRaw.includes('ASSISTANT') ? 'ASSISTANT' : 'TEACHER', phone: textCell(row, ['SDT', 'PHONE']) || null, primary_subject: textCell(row, ['MON', 'SUBJECT']) || null, note: textCell(row, ['GHI CHU', 'NOTE']) || null });
      }
    } else if (key.startsWith('LOP') || key.includes('ROSTER')) {
      const suffix = sheetName.match(/(?:LOP|CLASS)[_ -]?(\d{1,2})/i)?.[1];
      const derivedClassCode = suffix ? `L${suffix.padStart(2, '0')}` : '';
      for (const row of records) {
        const code = textCell(row, ['MA HS', 'MAHS', 'CODE', 'STUDENT CODE']);
        const fullName = textCell(row, ['HO TEN', 'HOTEN', 'TEN HS', 'FULL NAME', 'NAME']);
        if (!code && !fullName) continue;
        if (!code || !fullName) { issues.push({ severity: 'ERROR', sheet_name: sheetName, code: 'STUDENT_REQUIRED_FIELDS', message: 'Học sinh thiếu mã hoặc họ tên' }); continue; }
        const classCode = textCell(row, ['MA LOP', 'MALOP', 'CLASS CODE']) || derivedClassCode;
        if (!classCode) issues.push({ severity: 'WARNING', sheet_name: sheetName, code: 'STUDENT_CLASS_UNMAPPED', message: `Chưa xác định lớp cho ${code}` });
        const enrolledFrom = dateCell(row, ['NGAY VAO', 'NGAY VAO LOP', 'ENROLLED FROM']);
        if (cell(row, ['NGAY VAO', 'NGAY VAO LOP', 'ENROLLED FROM']) && !enrolledFrom) issues.push({ severity: 'WARNING', sheet_name: sheetName, code: 'DATE_FORMAT', message: `Không parse được ngày vào lớp của ${code}; cần xử lý nguồn` });
        students.push({ code, full_name: fullName, phone: textCell(row, ['SDT', 'PHONE']) || null, parent_name: textCell(row, ['TEN PHU HUYNH', 'PARENT NAME']) || null, parent_phone: textCell(row, ['SDT PHU HUYNH', 'PARENT PHONE']) || null, note: textCell(row, ['GHI CHU', 'NOTE']) || null, class_code: classCode || null, enrolled_from: enrolledFrom, unit_price_override: integerCell(row, ['DON GIA RIENG', 'UNIT PRICE']) });
      }
    }
    return { sheet_name: sheetName, row_count: Math.max(0, rawRows.length - 1), sample };
  });
  if (workbook.SheetNames.length === 0) issues.push({ severity: 'ERROR', sheet_name: '', code: 'EMPTY_WORKBOOK', message: 'Workbook không có sheet' });
  if (classes.length === 0 && staff.length === 0 && students.length === 0) issues.push({ severity: 'ERROR', sheet_name: '', code: 'NO_NORMALIZED_ROWS', message: 'Không tìm thấy dòng lớp, nhân sự hoặc học sinh theo mapping chuẩn' });
  const hasUnmappedOperationalSheets = workbook.SheetNames.some((name: string) => { const key = normalize(name); return key.includes('KT') || key.includes('THUCHI') || key.includes('LUONG') || key.includes('CHUYENTHANG'); });
  if (hasUnmappedOperationalSheets) issues.push({ severity: 'WARNING', sheet_name: '', code: 'OPERATIONAL_SHEET_REVIEW', message: 'Sheet tài chính/điểm danh cần đối chiếu mapping nghiệp vụ trước khi import' });
  return { payload: { classes, staff, students }, issues, summaries };
}

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { userId, profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<Payload>(request);
    const admin = ctx.supabaseAdmin;
    if (!admin) throw new Error('INTERNAL_ERROR');
    let jobId = body.import_job_id ? requiredUuid(body.import_job_id) : '';
    let storagePath = body.storage_path?.trim() || '';
    const mode = body.mode ?? 'VALIDATE';
    if (!['VALIDATE', 'IMPORT', 'RECONCILE'].includes(mode)) throw new Error('VALIDATION_ERROR');
    if (!jobId) {
      const fileName = requiredString(body.file_name);
      if (!body.file_base64) throw new Error('VALIDATION_ERROR');
      const bytes = Uint8Array.from(atob(body.file_base64), (character) => character.charCodeAt(0));
      jobId = crypto.randomUUID();
      storagePath = `${profile.center_id}/${jobId}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const upload = await admin.storage.from('center-imports').upload(storagePath, bytes, { contentType: 'application/octet-stream', upsert: false });
      if (upload.error) throw upload.error;
      const created = await admin.from('import_jobs').insert({ id: jobId, center_id: profile.center_id, file_name: fileName, storage_path: storagePath, mode, status: 'UPLOADED', created_by: userId }).select('id').single();
      if (created.error) throw created.error;
    }
    const job = await admin.from('import_jobs').select('*').eq('id', jobId).eq('center_id', profile.center_id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data || (!storagePath && !job.data.storage_path)) throw new Error('NOT_FOUND');
    storagePath = storagePath || job.data.storage_path;
    const started = await admin.from('import_jobs').update({ status: mode === 'IMPORT' ? 'IMPORTING' : 'VALIDATING', mode, started_at: new Date().toISOString(), error_message: null }).eq('id', jobId);
    if (started.error) throw started.error;
    const downloaded = await admin.storage.from('center-imports').download(storagePath);
    if (downloaded.error || !downloaded.data) throw downloaded.error ?? new Error('IMPORT_VALIDATION_FAILED');
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(await downloaded.data.arrayBuffer()), { type: 'array', cellDates: false });
    const normalized = normalizeWorkbook(XLSX, workbook);
    const issueRows = normalized.issues.map((issue) => ({ import_job_id: jobId, ...issue }));
    const cleared = await admin.from('import_job_issues').delete().eq('import_job_id', jobId);
    if (cleared.error) throw cleared.error;
    if (issueRows.length) { const inserted = await admin.from('import_job_issues').insert(issueRows); if (inserted.error) throw inserted.error; }
    const hasErrors = normalized.issues.some((issue) => issue.severity === 'ERROR');
    if (mode === 'IMPORT' && hasErrors) throw new Error('IMPORT_VALIDATION_FAILED');
    const baseSummary = { sheets: normalized.summaries, normalized_counts: { classes: normalized.payload.classes.length, staff: normalized.payload.staff.length, students: normalized.payload.students.length }, issue_count: normalized.issues.length, error_count: normalized.issues.filter((issue) => issue.severity === 'ERROR').length, trace_id: traceId };
    if (mode === 'IMPORT') {
      const imported = await ctx.supabase.rpc('rpc_import_normalized_workbook', { p_import_job_id: jobId, p_payload: normalized.payload, p_trace_id: traceId });
      if (imported.error) throw imported.error;
      const summary = { ...baseSummary, imported: imported.data };
      const updated = await admin.from('import_jobs').update({ status: 'COMPLETED', summary, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
      if (updated.error) throw updated.error;
      return finish(request, ok({ import_job_id: jobId, status: 'COMPLETED', summary, issues: normalized.issues }, traceId));
    }
    const status = hasErrors ? 'FAILED' : 'READY';
    const summary = mode === 'RECONCILE' ? { ...baseSummary, reconciliation: { status: 'PENDING_SOURCE_TOTALS', message: 'Cần cung cấp target totals để đối chiếu KPI tháng 08/2026' } } : baseSummary;
    const updated = await admin.from('import_jobs').update({ status, summary, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
    if (updated.error) throw updated.error;
    return finish(request, ok({ import_job_id: jobId, status, summary, issues: normalized.issues }, traceId));
  } catch (error) {
    return errorResponse(error, request, traceId);
  }
}) };
