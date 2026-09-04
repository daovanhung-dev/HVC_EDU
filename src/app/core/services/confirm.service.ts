import { Injectable } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  ask(message: string): boolean { return window.confirm(message); }
}
