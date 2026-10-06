import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { FOODS, FOOD_IDS, foodShort } from '../../core/data/foods';
import { BloatStat } from '../../core/models';
import { BloatService } from '../../core/services/bloat.service';
import { StoreService } from '../../core/services/store.service';
import { ToastService } from '../../core/services/toast.service';
import { UiService } from '../../core/services/ui.service';
import { F, inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-digestion-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <div class="grid grid-cols-2 gap-4 tablet:grid-cols-1">
        <div class="card">
          <div class="card-head">
            <h3><app-icon name="leaf" /> Bu gün köp necədir?</h3>
            <span class="text-muted">{{ F.short(ui.viewDate()) }}</span>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-[40px] font-extrabold tabular-nums">{{ bloat.level() }}</span><span class="badge">{{ levelText(bloat.level()) }}</span>
          </div>
          <input type="range" min="0" max="10" step="1" class="h-7 w-full accent-accent" [value]="bloat.level()" (input)="bloat.level.set(+val($event))" aria-label="Köp səviyyəsi" />
          <div class="flex flex-wrap items-center justify-between gap-2 text-muted" style="font-size: 11px; margin-bottom: 12px"><span>0 — yoxdur</span><span>10 — çox güclü</span></div>

          <div class="section-title">Bu günün menyusundan qidalar</div>
          <div class="flex flex-wrap gap-1.5">
            @for (id of menuFoods(); track id) {
              <button class="chip" [class.chip-on]="selected().has(id)" (click)="toggleFood(id)">{{ foodShort(id) }}</button>
            } @empty {
              <span class="text-muted">Menyu yoxdur</span>
            }
          </div>
          <div class="section-title" style="margin-top: 12px">Digər qidalar</div>
          <div class="flex flex-wrap gap-1.5">
            @for (id of otherFoods(); track id) {
              <button class="chip" [class.chip-on]="selected().has(id)" (click)="toggleFood(id)">{{ foodShort(id) }}</button>
            }
          </div>
          <div class="flex flex-wrap items-center gap-2" style="margin-top: 12px">
            <input #extra type="text" placeholder="Başqa qida (məs: noxud, kələm, qazlı içki)" style="flex: 1" (keydown.enter)="addExtra(extra)" />
            <button class="btn btn-sm" (click)="addExtra(extra)"><app-icon name="plus" size="sm" />Əlavə et</button>
          </div>
          <input #note type="text" placeholder="Qeyd (istəyə bağlı)" style="width: 100%; margin-top: 8px" />
          <button class="btn btn-primary" style="width: 100%; margin-top: 12px" (click)="save(note)"><app-icon name="save" size="sm" />Qeyd et</button>
        </div>

        <div class="card">
          <div class="card-head"><h3><app-icon name="trend" /> Qida ↔ köp əlaqəsi</h3></div>
          @for (x of bloat.stats(); track x.key) {
            <div
              class="grid grid-cols-[minmax(120px,1.2fr)_2fr_70px] items-center gap-3 border-b border-border-soft py-2.5 last:border-b-0 phone:grid-cols-[1fr_1fr_50px]"
            >
              <div>
                <b>{{ x.name }}</b>
                <div class="text-muted" style="font-size: 11.5px">{{ x.n }} qeyd</div>
              </div>
              <div>
                <div class="bar h-[10px]!"><i [class]="levelClass(x.avg)" [style.width.%]="x.avg * 10"></i></div>
                <div style="font-size: 12px; margin-top: 4px" [style.color]="verdict(x).color">{{ verdict(x).text }}</div>
              </div>
              <b style="text-align: right">{{ F.r1(x.avg) }}/10</b>
            </div>
          } @empty {
            <div class="empty">Qeydlər artdıqca burada qidalarla köp arasındakı əlaqə görünəcək.</div>
          }
          <div class="alert alert-info" style="margin-top: 12px">
            <app-icon name="info" />
            <div>
              Bu, sadəcə qeydlərinə əsaslanan müşahidədir, tibbi diaqnoz deyil. ≥ 6/10 orta göstəricisi və ən azı 2 qeydi olan qidalar yeni
              menyularda avtomatik azaldılır/əvəz edilir. Davamlı və ya güclü şikayət olarsa həkimə müraciət et.
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Qeyd tarixçəsi</h3></div>
        @if (history().length) {
          <div class="overflow-x-auto" style="border: 0">
            <table class="tbl">
              <thead>
                <tr><th>Tarix</th><th class="tbl-num">Köp</th><th>Qidalar</th><th>Qeyd</th><th></th></tr>
              </thead>
              <tbody>
                @for (e of history(); track e.id) {
                  <tr>
                    <td>{{ F.short(e.date) }} {{ e.time }}</td>
                    <td class="tbl-num"><b>{{ e.level }}/10</b></td>
                    <td class="tbl-text">{{ foodList(e.foods) }}</td>
                    <td class="tbl-text">{{ e.note }}</td>
                    <td class="tbl-num">
                      <button class="btn btn-ghost btn-icon btn-sm btn-danger" (click)="bloat.remove(e.id)" aria-label="Sil"><app-icon name="trash" size="sm" /></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">Hələ qeyd yoxdur.</div>
        }
      </div>
    </div>
  `,
})
export class DigestionPage {
  protected readonly F = F;
  protected readonly val = inputValue;
  protected readonly foodShort = foodShort;
  protected readonly levelText = BloatService.levelText;
  protected readonly levelClass = BloatService.levelClass;

  protected readonly ui = inject(UiService);
  protected readonly bloat = inject(BloatService);
  private readonly store = inject(StoreService);
  private readonly toast = inject(ToastService);

  protected readonly menuFoods = computed(() => this.bloat.dayFoods(this.ui.viewDate()));
  /** Pre-selects the day's eaten foods; resets when the day (or its meals) change. */
  protected readonly selected = linkedSignal(() => new Set(this.menuFoods()));
  protected readonly otherFoods = computed(() => {
    const menu = new Set(this.menuFoods());
    const custom = [...this.selected()].filter((f) => !FOODS[f] && !menu.has(f));
    return [...FOOD_IDS.filter((id) => !menu.has(id)), ...custom];
  });
  protected readonly history = computed(() =>
    [...this.store.state().bloat].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 30),
  );

  protected toggleFood(id: string): void {
    this.selected.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected addExtra(input: HTMLInputElement): void {
    const parts = input.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    this.selected.update((s) => {
      const n = new Set(s);
      for (const x of parts) n.add(FOOD_IDS.find((id) => foodShort(id).toLowerCase() === x) ?? `x:${x}`);
      return n;
    });
    input.value = '';
  }

  protected save(note: HTMLInputElement): void {
    if (!this.selected().size) {
      this.toast.show('Ən azı bir qida seç');
      return;
    }
    this.bloat.save(this.ui.viewDate(), this.bloat.level(), this.selected(), note.value.trim());
    note.value = '';
  }

  protected verdict(x: BloatStat): { text: string; color: string } {
    if (x.n >= 2 && x.avg >= 6) {
      const alt = FOODS[x.key]?.alt;
      return { text: `Bu qidanı bir müddət azalt və alternativini yoxla${alt ? ` (məs: ${foodShort(alt)})` : ''}.`, color: 'var(--bad)' };
    }
    if (x.avg >= 4) return { text: 'Müşahidə et — porsiyanı kiçilt.', color: 'var(--warn)' };
    if (x.n >= 2) return { text: 'Yaxşı tolere olunur.', color: 'var(--good)' };
    return { text: 'Hələ az məlumat.', color: 'var(--muted)' };
  }

  protected foodList(foods: string[]): string {
    return foods.map(foodShort).join(', ');
  }
}
