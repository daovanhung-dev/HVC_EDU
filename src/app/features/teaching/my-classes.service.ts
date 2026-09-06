import { Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { todayIso } from '../../core/utils/date.util';

export type MyClassAssignment = {
  id: string;
  class_id: string;
  role: string;
  start_date: string;
  end_date: string | null;
  period_id: string | null;
};

export type MyClass = {
  id: string;
  code: string;
  name: string;
  grade: number;
  subject: string;
  status: string;
  assignments: MyClassAssignment[];
};

export type MyClassStudent = {
  enrollment_id: string;
  student_id: string;
  enrolled_from: string;
  enrolled_to: string | null;
  status: string;
  student: {
    id: string;
    code: string;
    full_name: string;
    phone: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    status: string;
  } | null;
};

export type MyClassSchedule = {
  id: string;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  effective_from: string;
  effective_to: string | null;
};

export type MyClassSession = {
  id: string;
  period_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

export type AttendanceSummary = {
  enrollment_id: string;
  student_id: string;
  student: MyClassStudent['student'];
  present_count: number;
  absent_count: number;
  excused_count: number;
  marked_count: number;
};

export type EvaluationHistory = {
  id: string;
  session_id: string;
  session_date: string;
  start_time: string | null;
  enrollment_id: string;
  student_id: string;
  student: MyClassStudent['student'];
  homework_score: number | string | null;
  understanding_score: number | string | null;
  attitude_score: number | string | null;
  learning_gap: string | null;
  comment: string | null;
  updated_at: string;
};

export type MyClassOverview = {
  classInfo: Omit<MyClass, 'assignments'>;
  assignments: MyClassAssignment[];
  schedules: MyClassSchedule[];
  students: MyClassStudent[];
  sessions: MyClassSession[];
  attendanceSummary: AttendanceSummary[];
  evaluations: EvaluationHistory[];
};

@Injectable({ providedIn: 'root' })
export class MyClassesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listAssignedClasses(): Promise<MyClass[]> {
    const classesResult = await this.supabase.client
      .from('classes')
      .select('id,code,name,grade,subject,status')
      .eq('status', 'ACTIVE')
      .order('grade')
      .order('code');
    if (classesResult.error) throw classesResult.error;

    const classes = (classesResult.data ?? []) as Omit<MyClass, 'assignments'>[];
    if (!classes.length) return [];

    const assignmentsResult = await this.supabase.client
      .from('class_assignments')
      .select('id,class_id,role,start_date,end_date,period_id')
      .in('class_id', classes.map((item) => item.id))
      .order('start_date', { ascending: false });
    if (assignmentsResult.error) throw assignmentsResult.error;

    const assignmentsByClass = new Map<string, MyClassAssignment[]>();
    for (const assignment of (assignmentsResult.data ?? []) as MyClassAssignment[]) {
      if (!this.isCurrentAssignment(assignment)) continue;
      const current = assignmentsByClass.get(assignment.class_id) ?? [];
      current.push(assignment);
      assignmentsByClass.set(assignment.class_id, current);
    }

    return classes
      .filter((item) => assignmentsByClass.has(item.id))
      .map((item) => ({ ...item, assignments: assignmentsByClass.get(item.id) ?? [] }));
  }

  async getOverview(classId: string): Promise<MyClassOverview> {
    const [classResult, assignmentsResult, schedulesResult, studentsResult, sessionsResult] = await Promise.all([
      this.supabase.client.from('classes').select('id,code,name,grade,subject,status').eq('id', classId).eq('status', 'ACTIVE').maybeSingle(),
      this.supabase.client.from('class_assignments').select('id,class_id,role,start_date,end_date,period_id').eq('class_id', classId).order('start_date', { ascending: false }),
      this.supabase.client.from('class_schedules').select('id,weekday,start_time,end_time,effective_from,effective_to').eq('class_id', classId).eq('active', true).order('weekday').order('start_time'),
      this.supabase.client.from('enrollments').select('id,student_id,enrolled_from,enrolled_to,status,student:students(id,code,full_name,phone,parent_name,parent_phone,status)').eq('class_id', classId).eq('status', 'ACTIVE').order('enrolled_from'),
      this.supabase.client.from('class_sessions').select('id,period_id,session_date,start_time,end_time,status').eq('class_id', classId).order('session_date', { ascending: false }).order('start_time', { ascending: false }),
    ]);

    for (const result of [classResult, assignmentsResult, schedulesResult, studentsResult, sessionsResult]) {
      if (result.error) throw result.error;
    }
    if (!classResult.data) throw new Error('CLASS_NOT_FOUND');

    const assignments = ((assignmentsResult.data ?? []) as MyClassAssignment[]).filter((item) => this.isCurrentAssignment(item));
    const schedules = (schedulesResult.data ?? []) as MyClassSchedule[];
    const students = (studentsResult.data ?? []).map((row: any) => ({
      enrollment_id: row.id,
      student_id: row.student_id,
      enrolled_from: row.enrolled_from,
      enrolled_to: row.enrolled_to ?? null,
      status: row.status,
      student: row.student ?? null,
    })) as MyClassStudent[];
    const sessions = (sessionsResult.data ?? []) as MyClassSession[];
    const sessionIds = sessions.map((item) => item.id);
    const [attendanceRows, evaluationRows] = sessionIds.length
      ? await Promise.all([
        this.supabase.client.from('attendance').select('id,session_id,enrollment_id,status,note,marked_at').in('session_id', sessionIds),
        this.supabase.client.from('student_session_evaluations').select('id,session_id,enrollment_id,homework_score,understanding_score,attitude_score,learning_gap,comment,updated_at').in('session_id', sessionIds),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (attendanceRows.error) throw attendanceRows.error;
    if (evaluationRows.error) throw evaluationRows.error;

    const studentByEnrollment = new Map(students.map((item) => [item.enrollment_id, item]));
    const sessionById = new Map(sessions.map((item) => [item.id, item]));
    const attendanceSummary = students.map((item) => ({
      enrollment_id: item.enrollment_id,
      student_id: item.student_id,
      student: item.student,
      present_count: 0,
      absent_count: 0,
      excused_count: 0,
      marked_count: 0,
    })) as AttendanceSummary[];
    const summaryByEnrollment = new Map(attendanceSummary.map((item) => [item.enrollment_id, item]));

    for (const row of (attendanceRows.data ?? []) as any[]) {
      const summary = summaryByEnrollment.get(row.enrollment_id);
      if (!summary) continue;
      summary.marked_count += 1;
      if (row.status === 'PRESENT') summary.present_count += 1;
      if (row.status === 'ABSENT') summary.absent_count += 1;
      if (row.status === 'EXCUSED') summary.excused_count += 1;
    }

    const evaluations = ((evaluationRows.data ?? []) as any[])
      .map((row) => {
        const student = studentByEnrollment.get(row.enrollment_id);
        const session = sessionById.get(row.session_id);
        if (!student || !session) return null;
        return {
          id: row.id,
          session_id: row.session_id,
          session_date: session.session_date,
          start_time: session.start_time,
          enrollment_id: row.enrollment_id,
          student_id: student.student_id,
          student: student.student,
          homework_score: row.homework_score ?? null,
          understanding_score: row.understanding_score ?? null,
          attitude_score: row.attitude_score ?? null,
          learning_gap: row.learning_gap ?? null,
          comment: row.comment ?? null,
          updated_at: row.updated_at,
        } satisfies EvaluationHistory;
      })
      .filter((row): row is EvaluationHistory => row !== null)
      .sort((left, right) => `${right.session_date}T${right.start_time ?? ''}`.localeCompare(`${left.session_date}T${left.start_time ?? ''}`));

    return {
      classInfo: classResult.data as Omit<MyClass, 'assignments'>,
      assignments,
      schedules,
      students,
      sessions,
      attendanceSummary,
      evaluations,
    };
  }

  private isCurrentAssignment(assignment: Pick<MyClassAssignment, 'start_date' | 'end_date'>): boolean {
    const today = todayIso();
    return assignment.start_date <= today && (!assignment.end_date || assignment.end_date >= today);
  }
}
