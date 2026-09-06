import { Injectable } from '@angular/core';
import { ApiError } from '../api/api-error';
import { RootApiService } from '../api/root-api.service';
import { RootAuthService } from '../auth/root-auth.service';

export type RootCenter = { id: string; code: string; name: string; status: 'ACTIVE' | 'INACTIVE' };
export type RootAdminAccount = {
  user_id: string;
  email: string | null;
  center_id: string;
  center: Pick<RootCenter, 'id' | 'code' | 'name'> | null;
  full_name: string;
  role: 'ADMIN';
  active: boolean;
  created_at: string;
};
export type RootAdminList = { admins: RootAdminAccount[]; centers: RootCenter[] };

@Injectable({ providedIn: 'root' })
export class RootAdminService {
  constructor(private readonly api: RootApiService, private readonly auth: RootAuthService) {}

  async list(): Promise<RootAdminList> { return this.api.invoke<RootAdminList>('root-admin-accounts', { operation: 'LIST' }, this.token()); }

  async create(fullName: string, email: string, centerId: string): Promise<unknown> {
    return this.api.invoke('root-admin-accounts', { operation: 'CREATE', full_name: fullName, email, center_id: centerId }, this.token());
  }

  async deactivate(userId: string): Promise<unknown> {
    return this.api.invoke('root-admin-accounts', { operation: 'DEACTIVATE', user_id: userId }, this.token());
  }

  private token(): string {
    const token = this.auth.accessToken();
    if (!token) throw new ApiError({ code: 'ROOT_UNAUTHENTICATED', message: 'Phiên Root không hợp lệ hoặc đã hết hạn.', details: null });
    return token;
  }
}

