import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session() ?? (await auth.refreshSession().catch(() => null));
  return session ? router.createUrlTree(['/dashboard']) : true;
};
