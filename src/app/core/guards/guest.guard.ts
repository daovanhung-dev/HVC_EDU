import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { RootAuthService } from '../auth/root-auth.service';
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const rootAuth = inject(RootAuthService);
  const router = inject(Router);
  if (rootAuth.isAuthenticated()) return router.createUrlTree(['/root/admins']);
  const session = auth.session() ?? (await auth.refreshSession().catch(() => null));
  return session ? router.createUrlTree(['/dashboard']) : true;
};
