export type AppRole = 'ADMIN' | 'ACCOUNTANT' | 'TEACHER' | 'ASSISTANT';
export type Profile = { user_id: string; center_id: string; full_name: string; role: AppRole; staff_id: string | null; active: boolean };
