import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class RestTimerService {
  private readonly toast = inject(ToastService);
  readonly left = signal(0);
  readonly active = signal(false);
  private timer: ReturnType<typeof setInterval> | undefined;

  start(sec: number): void {
    this.left.set(sec);
    this.active.set(true);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      const next = this.left() - 1;
      if (next <= 0) {
        this.stop();
        this.toast.show('İstirahət bitdi — növbəti set!');
        navigator.vibrate?.(200);
      } else this.left.set(next);
    }, 1000);
  }

  add(sec: number): void {
    this.left.update((v) => v + sec);
  }

  stop(): void {
    clearInterval(this.timer);
    this.active.set(false);
  }
}
