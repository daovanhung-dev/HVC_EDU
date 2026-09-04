import { Injectable } from '@angular/core';
import { EdgeFunctionService } from '../api/edge-function.service';

export type DashboardTaskCode =
  | 'ATTENDANCE_PENDING'
  | 'EVALUATION_PENDING'
  | 'TUITION_LEDGER_PENDING'
  | 'PAYROLL_PENDING_APPROVAL'
  | 'INTEGRITY_WARNING';

export type DashboardTask = {
  code: DashboardTaskCode;
  count: number;
  severity: 'INFO' | 'WARNING' | 'BLOCKED';
  label: string;
  route: string;
  actionLabel: string;
};

export type UpcomingSession = {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  session_date: string;
  start_time: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  attendance_marked: boolean;
  evaluation_marked: boolean;
};

export type DashboardSummary = {
  period: { id?: string; month: number; year: number; status: string } | null;
  activeClasses: number;
  activeStudents: number;
  totalDue: number;
  totalPaid: number;
  totalDebt: number;
  payrollTotal: number;
  otherIncome: number;
  otherExpense: number;
  rewards: number;
  profitBeforeFund: number;
  fundContribution: number;
  distributableProfit: number;
  alerts: string[];
  role: string;
  tasks: DashboardTask[];
  upcomingSessions: UpcomingSession[];
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly edge: EdgeFunctionService) {}

  load(periodId?: string): Promise<DashboardSummary> {
    return this.edge.invoke<DashboardSummary>('dashboard-summary', periodId ? { period_id: periodId } : {});
  }
}
