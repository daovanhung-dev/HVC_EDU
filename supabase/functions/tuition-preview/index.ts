import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = { period_id?: string; class_id?: string };

function asBigInt(value: unknown): bigint {
  const text = String(value ?? '0');
  if (!/^-?\d+$/.test(text)) throw new Error('VALIDATION_ERROR');
  return BigInt(text);
}

function asJsonMoney(value: bigint): number | string {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  return value <= maxSafe && value >= -maxSafe ? Number(value) : value.toString();
}

function requireResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN', 'ACCOUNTANT']);
    const body = await jsonBody<Payload>(request);
    const periodId = requiredUuid(body.period_id);
    const classId = body.class_id ? requiredUuid(body.class_id) : null;
    const period = requireResult<any>(await ctx.supabase.from('accounting_periods').select('id,start_date,end_date,status').eq('id', periodId).maybeSingle());
    if (!period) throw new Error('PERIOD_NOT_FOUND');

    const [enrollmentResult, sessionResult, adjustmentResult, currentLedgerResult, configResult] = await Promise.all([
      ctx.supabase.from('enrollments').select('id,class_id,enrolled_from,enrolled_to,unit_price_override,tuition_exempt,student:students(id,code,full_name),class:classes(id,code,name,standard_unit_fee,collection_method)').eq('status', 'ACTIVE'),
      ctx.supabase.from('class_sessions').select('id,class_id,status').eq('period_id', periodId).neq('status', 'CANCELLED'),
      ctx.supabase.from('tuition_adjustments').select('enrollment_id,type,amount,source_period_id').eq('period_id', periodId),
      ctx.supabase.from('tuition_ledgers').select('enrollment_id,status,paid_amount,amount_due').eq('period_id', periodId),
      ctx.supabase.from('period_class_configs').select('class_id,active,unit_fee,collection_method,note').eq('period_id', periodId),
    ]);
    const enrollments = (requireResult<any[]>(enrollmentResult) ?? []).filter((item: any) =>
      (!classId || item.class_id === classId) &&
      item.enrolled_from <= period.end_date &&
      (!item.enrolled_to || item.enrolled_to >= period.start_date));
    const sessions = requireResult<any[]>(sessionResult) ?? [];
    const adjustments = requireResult<any[]>(adjustmentResult) ?? [];
    const currentLedgers = requireResult<any[]>(currentLedgerResult) ?? [];
    const configs = new Map((requireResult<any[]>(configResult) ?? []).map((item: any) => [item.class_id, item]));
    const scopedEnrollments = enrollments.filter((item: any) => !configs.has(item.class_id) || configs.get(item.class_id)?.active !== false);
    const sessionIds = (sessions as any[]).map((item) => item.id);
    const attendanceResult = sessionIds.length
      ? await ctx.supabase.from('attendance').select('session_id,enrollment_id,status').in('session_id', sessionIds)
      : { data: [], error: null };
    const attendance = requireResult(attendanceResult as { data: any[]; error: unknown });
    const sessionsByClass = new Map<string, number>();
    for (const session of sessions as any[]) sessionsByClass.set(session.class_id, (sessionsByClass.get(session.class_id) ?? 0) + 1);
    const presentByEnrollment = new Map<string, number>();
    for (const item of attendance as any[]) if (item.status === 'PRESENT') presentByEnrollment.set(item.enrollment_id, (presentByEnrollment.get(item.enrollment_id) ?? 0) + 1);
    const ledgerByEnrollment = new Map((currentLedgers as any[]).map((item) => [item.enrollment_id, item]));
    const rows = (scopedEnrollments as any[]).map((enrollment) => {
      const configured = configs.get(enrollment.class_id);
      const classInfo = configured ? { ...enrollment.class, standard_unit_fee: configured.unit_fee, collection_method: configured.collection_method, note: configured.note } : enrollment.class;
      const classSessions = sessionsByClass.get(enrollment.class_id) ?? 0;
      const present = presentByEnrollment.get(enrollment.id) ?? 0;
      const prepaid = classInfo?.collection_method === 'PREPAID';
      const billableSessions = enrollment.tuition_exempt ? 0 : prepaid ? classSessions : present;
      const unitPrice = enrollment.tuition_exempt ? 0n : asBigInt(enrollment.unit_price_override ?? classInfo?.standard_unit_fee ?? 0);
      const grossAmount = BigInt(billableSessions) * unitPrice;
      let positiveAdjustments = 0n;
      let discount = 0n;
      let openingAdjustments = 0n;
      for (const adjustment of adjustments as any[]) {
        if (adjustment.enrollment_id !== enrollment.id) continue;
        const amount = asBigInt(adjustment.amount);
        if (adjustment.type === 'DISCOUNT') discount += amount;
        else if (adjustment.type === 'OPENING_DEBT' || adjustment.type === 'CARRY_IN') openingAdjustments += amount;
        else if (adjustment.type === 'MANUAL') positiveAdjustments += amount;
      }
      const openingDebt = openingAdjustments;
      const adjustmentAmount = positiveAdjustments - discount;
      const calculatedDue = grossAmount + openingDebt + adjustmentAmount;
      const amountDue = calculatedDue > 0n ? calculatedDue : 0n;
      const paidAmount = asBigInt(ledgerByEnrollment.get(enrollment.id)?.paid_amount ?? 0);
      const debtAmount = amountDue > paidAmount ? amountDue - paidAmount : 0n;
      const warnings: string[] = [];
      if (classSessions === 0) warnings.push('Chưa có buổi học trong kỳ');
      if (prepaid && classSessions > 0 && present < classSessions) warnings.push('PREPAID không phụ thuộc số buổi có mặt');
      const ledger = ledgerByEnrollment.get(enrollment.id);
      if (ledger?.status && ledger.status !== 'DRAFT') warnings.push('Ledger đã xác nhận; generate sẽ không ghi đè');
      return {
        enrollment_id: enrollment.id,
        student: enrollment.student,
        class: classInfo,
        billable_sessions: billableSessions,
        unit_price: asJsonMoney(unitPrice),
        gross_amount: asJsonMoney(grossAmount),
        opening_debt: asJsonMoney(openingDebt),
        adjustment_amount: asJsonMoney(adjustmentAmount),
        amount_due: asJsonMoney(amountDue),
        paid_amount: asJsonMoney(paidAmount),
        debt_amount: asJsonMoney(debtAmount),
        warnings,
      };
    });
    const totals = rows.reduce((result, row) => ({
      amount_due: result.amount_due + asBigInt(row.amount_due),
      paid_amount: result.paid_amount + asBigInt(row.paid_amount),
      debt_amount: result.debt_amount + asBigInt(row.debt_amount),
    }), { amount_due: 0n, paid_amount: 0n, debt_amount: 0n });
    return finish(request, ok({ rows, totals: { amount_due: asJsonMoney(totals.amount_due), paid_amount: asJsonMoney(totals.paid_amount), debt_amount: asJsonMoney(totals.debt_amount) } }, traceId));
  } catch (error) {
    return errorResponse(error, request, traceId);
  }
}) };
