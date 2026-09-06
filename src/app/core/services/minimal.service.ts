import { Injectable } from '@angular/core';
import { ApiError } from '../api/api-error';
import { EdgeFunctionService } from '../api/edge-function.service';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export type EntityStatus = 'ACTIVE' | 'INACTIVE';
export type StaffType = 'TEACHER' | 'ASSISTANT';
export type AssignmentRole = 'TEACHER' | 'ASSISTANT';
export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';
export type StaffAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';
export type TransactionType = 'INCOME' | 'EXPENSE';

export type CenterClass = {
  id: string;
  code: string;
  name: string;
  grade: number;
  subject: string;
  note: string | null;
  status: EntityStatus;
};

export type Student = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  note: string | null;
  status: EntityStatus;
  enrollments?: Enrollment[];
};

export type Staff = {
  id: string;
  code: string;
  full_name: string;
  staff_type: StaffType;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: EntityStatus;
};

export type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_from: string;
  enrolled_to: string | null;
  status: 'ACTIVE' | 'LEFT';
  student?: Pick<Student, 'id' | 'code' | 'full_name' | 'phone' | 'parent_name' | 'parent_phone'>;
  class?: Pick<CenterClass, 'id' | 'code' | 'name'>;
};

export type Schedule = { id: string; class_id: string; weekday: number; start_time: string | null; end_time: string | null; active: boolean };
export type Assignment = { id: string; class_id: string; staff_id: string; role: AssignmentRole; start_date: string; end_date: string | null; active: boolean; staff?: Pick<Staff, 'id' | 'code' | 'full_name' | 'staff_type'> };
export type ClassSession = { id: string; class_id: string; session_date: string; start_time: string | null; end_time: string | null; status: SessionStatus; note: string | null; class?: Pick<CenterClass, 'id' | 'code' | 'name'> };
export type AttendanceRow = { enrollment_id: string; student: Pick<Student, 'id' | 'code' | 'full_name'>; status: AttendanceStatus; note: string };
export type EvaluationRow = { enrollment_id: string; student: Pick<Student, 'id' | 'code' | 'full_name'>; comment: string };
export type StaffAttendance = { id: string; staff_id: string; attendance_date: string; status: StaffAttendanceStatus; note: string | null; staff?: Pick<Staff, 'code' | 'full_name'> };
export type FinancialTransaction = { id: string; transaction_date: string; type: TransactionType; category: string; description: string; amount: number; created_at: string };
export type DashboardSummary = { from_date: string; to_date: string; active_classes: number; active_students: number; active_staff: number; sessions: number; income: number; expense: number; balance: number; role: string };

@Injectable({ providedIn: 'root' })
export class MinimalService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly edge: EdgeFunctionService,
    private readonly auth: AuthService,
  ) {}

  private async read<T>(query: () => PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    let result = await query();
    if (this.isAuthFailure(result.error)) {
      try {
        const refreshed = await this.auth.refreshAccessToken();
        if (!refreshed) return this.expireSession();
      } catch {
        return this.expireSession();
      }
      result = await query();
      if (this.isAuthFailure(result.error)) return this.expireSession();
    }
    if (this.isForbidden(result.error)) {
      throw new ApiError({ code: 'FORBIDDEN', message: 'Bạn không có quyền xem dữ liệu này.', details: result.error });
    }
    if (result.error) throw result.error;
    return result.data;
  }

  private async expireSession(): Promise<never> {
    await this.auth.expireSession();
    throw new ApiError({ code: 'AUTH_SESSION_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  private isAuthFailure(error: unknown): boolean {
    const status = this.errorStatus(error);
    const code = this.errorProperty(error, 'code');
    const message = this.errorProperty(error, 'message').toLowerCase();
    return status === 401
      || code === 'PGRST301'
      || code === 'PGRST302'
      || /invalid.*jwt|jwt.*(expired|invalid)|token.*(expired|invalid)/i.test(message);
  }

  private isForbidden(error: unknown): boolean {
    return this.errorStatus(error) === 403 || this.errorProperty(error, 'code') === '42501';
  }

  private errorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object' || !('status' in error)) return null;
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : null;
  }

  private errorProperty(error: unknown, property: 'code' | 'message'): string {
    if (!error || typeof error !== 'object' || !(property in error)) return '';
    const value = (error as Record<string, unknown>)[property];
    return typeof value === 'string' ? value : '';
  }

  async listClasses(includeInactive = false): Promise<CenterClass[]> {
    return await this.read(() => {
      let query = this.supabase.client.from('classes').select('id,code,name,grade,subject,note,status').order('code');
      if (!includeInactive) query = query.eq('status', 'ACTIVE');
      return query;
    }) as unknown as CenterClass[];
  }

  async listStudents(includeInactive = false): Promise<Student[]> {
    return await this.read(() => {
      let query = this.supabase.client.from('students').select('id,code,full_name,phone,parent_name,parent_phone,note,status,enrollments(id,student_id,class_id,enrolled_from,enrolled_to,status,class:classes(id,code,name))').order('code');
      if (!includeInactive) query = query.eq('status', 'ACTIVE');
      return query;
    }) as unknown as Student[];
  }

  async listStaff(includeInactive = false): Promise<Staff[]> {
    return await this.read(() => {
      let query = this.supabase.client.from('staff').select('id,code,full_name,staff_type,phone,email,note,status').order('code');
      if (!includeInactive) query = query.eq('status', 'ACTIVE');
      return query;
    }) as unknown as Staff[];
  }

  async classDetail(classId: string): Promise<{ item: CenterClass; schedules: Schedule[]; assignments: Assignment[]; enrollments: Enrollment[]; sessions: ClassSession[] }> {
    const [item, schedules, assignments, enrollments, sessions] = await Promise.all([
      this.read(() => this.supabase.client.from('classes').select('id,code,name,grade,subject,note,status').eq('id', classId).maybeSingle()),
      this.read(() => this.supabase.client.from('class_schedules').select('id,class_id,weekday,start_time,end_time,active').eq('class_id', classId).order('weekday').order('start_time')),
      this.read(() => this.supabase.client.from('class_assignments').select('id,class_id,staff_id,role,start_date,end_date,active,staff:staff(id,code,full_name,staff_type)').eq('class_id', classId).order('active', { ascending: false }).order('start_date')),
      this.read(() => this.supabase.client.from('enrollments').select('id,student_id,class_id,enrolled_from,enrolled_to,status,student:students(id,code,full_name,phone,parent_name,parent_phone)').eq('class_id', classId).order('status').order('enrolled_from')),
      this.read(() => this.supabase.client.from('class_sessions').select('id,class_id,session_date,start_time,end_time,status,note').eq('class_id', classId).order('session_date', { ascending: false }).order('start_time', { ascending: false }).limit(100)),
    ]);
    const centerClass = item as unknown as CenterClass | null;
    if (!centerClass) throw new Error('CLASS_NOT_FOUND');
    return { item: centerClass, schedules: schedules as unknown as Schedule[], assignments: assignments as unknown as Assignment[], enrollments: enrollments as unknown as Enrollment[], sessions: sessions as unknown as ClassSession[] };
  }

  async sessionRoster(sessionId: string): Promise<{ session: ClassSession; attendance: AttendanceRow[]; evaluations: EvaluationRow[] }> {
    const session = await this.read(() => this.supabase.client.from('class_sessions').select('id,class_id,session_date,start_time,end_time,status,note,class:classes(id,code,name)').eq('id', sessionId).maybeSingle()) as unknown as ClassSession | null;
    if (!session) throw new Error('SESSION_NOT_FOUND');
    const [enrollmentResult, attendanceResult, evaluationResult] = await Promise.all([
      this.read(() => this.supabase.client.from('enrollments').select('id,student:students(id,code,full_name)').eq('class_id', session.class_id).eq('status', 'ACTIVE').order('id')),
      this.read(() => this.supabase.client.from('attendance').select('enrollment_id,status,note').eq('session_id', sessionId)),
      this.read(() => this.supabase.client.from('student_evaluations').select('enrollment_id,comment').eq('session_id', sessionId)),
    ]);
    const enrollments = enrollmentResult as unknown as Array<{ id: string; student: Pick<Student, 'id' | 'code' | 'full_name'> }>;
    const attendanceByEnrollment = new Map((attendanceResult as unknown as Array<{ enrollment_id: string; status: AttendanceStatus; note: string | null }>).map((row) => [row.enrollment_id, row]));
    const evaluationByEnrollment = new Map((evaluationResult as unknown as Array<{ enrollment_id: string; comment: string | null }>).map((row) => [row.enrollment_id, row]));
    return {
      session,
      attendance: enrollments.map((row) => ({ enrollment_id: row.id, student: row.student, status: attendanceByEnrollment.get(row.id)?.status ?? 'PRESENT', note: attendanceByEnrollment.get(row.id)?.note ?? '' })),
      evaluations: enrollments.map((row) => ({ enrollment_id: row.id, student: row.student, comment: evaluationByEnrollment.get(row.id)?.comment ?? '' })),
    };
  }

  async listSessions(fromDate: string, toDate: string, classId?: string): Promise<ClassSession[]> {
    return await this.read(() => {
      let query = this.supabase.client.from('class_sessions').select('id,class_id,session_date,start_time,end_time,status,note,class:classes(id,code,name)').gte('session_date', fromDate).lte('session_date', toDate).order('session_date').order('start_time');
      if (classId) query = query.eq('class_id', classId);
      return query;
    }) as unknown as ClassSession[];
  }

  async listStaffAttendance(fromDate: string, toDate: string, staffId?: string): Promise<StaffAttendance[]> {
    return await this.read(() => {
      let query = this.supabase.client.from('staff_attendance').select('id,staff_id,attendance_date,status,note,staff:staff(code,full_name)').gte('attendance_date', fromDate).lte('attendance_date', toDate).order('attendance_date', { ascending: false });
      if (staffId) query = query.eq('staff_id', staffId);
      return query;
    }) as unknown as StaffAttendance[];
  }

  async listTransactions(fromDate: string, toDate: string): Promise<FinancialTransaction[]> {
    return await this.read(() => this.supabase.client.from('financial_transactions').select('id,transaction_date,type,category,description,amount,created_at').gte('transaction_date', fromDate).lte('transaction_date', toDate).order('transaction_date', { ascending: false }).order('created_at', { ascending: false })) as unknown as FinancialTransaction[];
  }

  dashboard(fromDate: string, toDate: string): Promise<DashboardSummary> {
    return this.edge.invoke<DashboardSummary>('dashboard-summary', { from_date: fromDate, to_date: toDate });
  }

  upsertStaff(payload: Record<string, unknown>): Promise<Staff> { return this.edge.invoke<Staff>('admin-master-data', { operation: 'UPSERT_STAFF', ...payload }); }
  upsertClass(payload: Record<string, unknown>): Promise<CenterClass> { return this.edge.invoke<CenterClass>('admin-master-data', { operation: 'UPSERT_CLASS', ...payload }); }
  upsertStudent(payload: Record<string, unknown>): Promise<Student> { return this.edge.invoke<Student>('admin-master-data', { operation: 'UPSERT_STUDENT', ...payload }); }
  upsertEnrollment(payload: Record<string, unknown>): Promise<Enrollment> { return this.edge.invoke<Enrollment>('admin-master-data', { operation: 'UPSERT_ENROLLMENT', ...payload }); }
  upsertAssignment(payload: Record<string, unknown>): Promise<Assignment> { return this.edge.invoke<Assignment>('admin-master-data', { operation: 'UPSERT_ASSIGNMENT', ...payload }); }
  upsertSchedule(payload: Record<string, unknown>): Promise<Schedule> { return this.edge.invoke<Schedule>('admin-master-data', { operation: 'UPSERT_SCHEDULE', ...payload }); }
  deactivate(entity: 'staff' | 'classes' | 'students', id: string): Promise<{ id: string; status: EntityStatus }> { return this.edge.invoke('admin-master-data', { operation: 'DEACTIVATE', entity, id }); }
  inviteStaff(staffId: string, email: string): Promise<unknown> { return this.edge.invoke('invite-staff-account', { staff_id: staffId, email }); }
  generateSessions(fromDate: string, toDate: string): Promise<{ inserted: number }> { return this.edge.invoke('generate-class-sessions', { from_date: fromDate, to_date: toDate }, `sessions:${fromDate}:${toDate}`); }
  saveAttendance(sessionId: string, rows: AttendanceRow[]): Promise<unknown> { return this.edge.invoke('attendance-bulk-upsert', { session_id: sessionId, rows: rows.map((row) => ({ enrollment_id: row.enrollment_id, status: row.status, note: row.note || null })) }); }
  saveEvaluations(sessionId: string, rows: EvaluationRow[]): Promise<unknown> { return this.edge.invoke('evaluation-bulk-upsert', { session_id: sessionId, rows: rows.map((row) => ({ enrollment_id: row.enrollment_id, comment: row.comment || null })) }); }
  saveStaffAttendance(payload: { staff_id?: string; attendance_date: string; status: StaffAttendanceStatus; note?: string | null }): Promise<StaffAttendance> { return this.edge.invoke('staff-attendance', payload); }
  recordTransaction(payload: { transaction_id?: string; transaction_date: string; type: TransactionType; category: string; description: string; amount: number }): Promise<FinancialTransaction> { return this.edge.invoke('record-financial-transaction', payload); }

  static currentMonth(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: MinimalService.iso(from), to: MinimalService.iso(today) };
  }

  static iso(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
