import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RootAuthService } from '../auth/root-auth.service';

export const rootGuard: CanActivateFn = () => {
  const auth = inject(RootAuthService);
  const router = inject(Router);
  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { reason: 'root-session-expired' } });
};

