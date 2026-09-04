import { Injectable, signal } from '@angular/core';
export type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string };
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private nextId = 1;
  show(message: string, kind: Toast['kind'] = 'info'): void {
    const toast = { id: this.nextId++, kind, message };
    this.items.update((items) => [...items, toast]);
    window.setTimeout(() => this.items.update((items) => items.filter((item) => item.id !== toast.id)), 4200);
  }
  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void { this.show(message, 'error'); }
}
