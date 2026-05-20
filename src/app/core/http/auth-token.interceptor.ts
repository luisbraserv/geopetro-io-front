import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngxs/store';

import { AuthState } from '../../features/auth/state/auth.state';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(Store);
  const token = store.selectSnapshot(AuthState.token);

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
