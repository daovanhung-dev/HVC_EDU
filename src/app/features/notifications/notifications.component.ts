import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Notification, NotificationService } from '../../core/services/notification.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">INBOX</p><h1>Thông báo</h1><p class="page-description muted">Thông tin vận hành được gửi trực tiếp trong ứng dụng; không dùng email hoặc push ở phiên bản này.</p></div><div class="page-header-actions"><button class="secondary" type="button" [disabled]="loading()" (click)="load()">↻ Làm mới</button><button class="secondary" type="button" [disabled]="!unreadCount()" (click)="markAll()">Đánh dấu tất cả đã đọc</button></div></section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    <section class="notification-layout">
      <div class="card notification-list"><div class="panel-heading"><div><p class="eyebrow">{{ unreadCount() }} CHƯA ĐỌC</p><h2>Hộp thư của tôi</h2></div></div>@if(loading()){<div class="loading-state"><span class="loading-spinner"></span><span>Đang tải inbox…</span></div>}@else{@for(item of items(); track item.id){<article class="notification-row" [class.is-unread]="!item.read_at"><div class="notification-severity" [class]="'severity-' + item.severity.toLowerCase()"></div><div class="notification-content"><div class="notification-heading"><strong>{{ item.title }}</strong><app-status-badge [value]="item.severity" /></div><p>{{ item.message }}</p><small class="muted">{{ item.created_at }}</small>@if(item.action_route){<a class="button-link" [routerLink]="item.action_route" (click)="read(item)">Mở xử lý →</a>}</div>@if(!item.read_at){<button class="button-link notification-read" type="button" (click)="read(item)">Đã đọc</button>}</article>}@empty{<div class="empty-state"><strong>Inbox đang trống</strong><p class="muted">Các request công, payroll và cảnh báo quan trọng sẽ xuất hiện ở đây.</p></div>}}</div>
      @if (auth.role() === 'ADMIN') { <section class="card section-card notification-compose"><div class="panel-heading"><div><p class="eyebrow">ADMIN</p><h2>Gửi thông báo</h2><p class="muted">Gửi tới toàn trung tâm, một vai trò hoặc một tài khoản.</p></div></div><form class="form-grid" (ngSubmit)="send()"><label>Phạm vi<select name="scope" [(ngModel)]="form.scope"><option value="ALL">Toàn trung tâm</option><option value="ROLE">Theo vai trò</option><option value="USER">Một tài khoản</option></select></label>@if(form.scope === 'ROLE'){<label>Vai trò<select name="role" [(ngModel)]="form.role"><option value="TEACHER">Giáo viên</option><option value="ASSISTANT">Trợ giảng</option><option value="ACCOUNTANT">Kế toán</option><option value="ADMIN">Quản trị viên</option></select></label>}@if(form.scope === 'USER'){<label>Tài khoản<select name="recipient" [(ngModel)]="form.recipient_user_id"><option value="">Chọn người nhận</option>@for(user of users();track user.user_id){<option [value]="user.user_id">{{ user.full_name }} · {{ user.role }}</option>}</select></label>}<label class="full">Tiêu đề<input name="title" [(ngModel)]="form.title" required /></label><label class="full">Nội dung<textarea name="message" rows="4" [(ngModel)]="form.message" required></textarea></label><label>Mức độ<select name="severity" [(ngModel)]="form.severity"><option value="INFO">Thông tin</option><option value="WARNING">Cảnh báo</option><option value="BLOCKED">Chặn quy trình</option></select></label><label>Route xử lý<input name="action_route" [(ngModel)]="form.action_route" placeholder="/teaching-schedule" /></label><div class="form-actions full"><button class="primary" type="submit" [disabled]="sending">{{ sending ? 'Đang gửi…' : 'Gửi thông báo' }}</button></div></form></section> }
    </section>
  `,
})
export class NotificationsComponent implements OnInit {
  readonly items = signal<Notification[]>([]);
  readonly users = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  sending = false;
  form = { scope: 'ALL' as 'ALL' | 'ROLE' | 'USER', role: 'TEACHER', recipient_user_id: '', title: '', message: '', severity: 'INFO', action_route: '' };

  constructor(readonly auth: AuthService, readonly notifications: NotificationService, private readonly supabase: SupabaseService, private readonly toast: ToastService) {}
  ngOnInit(): void { void this.load(); }
  unreadCount(): number { return this.items().filter((item) => !item.read_at).length; }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.items.set(await this.notifications.list()); if (this.auth.role() === 'ADMIN') { const result = await this.supabase.client.from('profiles').select('user_id,full_name,role').eq('active', true).order('full_name'); if (result.error) throw result.error; this.users.set(result.data ?? []); } } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải thông báo.'); } finally { this.loading.set(false); } }
  async read(item: Notification): Promise<void> { if (item.read_at) return; try { await this.notifications.markRead(item.id); this.items.update((rows) => rows.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể đánh dấu đã đọc.'); } }
  async markAll(): Promise<void> { try { await this.notifications.markAllRead(); this.items.update((rows) => rows.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() }))); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật inbox.'); } }
  async send(): Promise<void> { if (!this.form.title.trim() || !this.form.message.trim() || (this.form.scope === 'USER' && !this.form.recipient_user_id)) { this.error.set('Tiêu đề, nội dung và người nhận là bắt buộc.'); return; } this.sending = true; try { await this.notifications.send({ ...this.form, title: this.form.title.trim(), message: this.form.message.trim(), action_route: this.form.action_route.trim() || undefined }); this.toast.success('Đã gửi thông báo.'); this.form = { ...this.form, title: '', message: '', action_route: '' }; } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể gửi thông báo.'); } finally { this.sending = false; } }
}
