import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import type { AppRole } from '../auth/auth.models';
export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as AppRole[];
  const profile = auth.profile() ?? (await auth.loadProfile().catch(() => null));
  return profile && (roles.length === 0 || roles.includes(profile.role)) ? true : router.createUrlTree(['/dashboard']);
};
