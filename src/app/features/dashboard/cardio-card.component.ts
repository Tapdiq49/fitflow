import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { newDay } from '../../common/interfaces';
import { DayService } from '../../core/services/day.service';
import { ProgramService } from '../../core/services/program.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { inputValue } from '../../core/utils';
import { IconComponent } from '../../shared/icon/icon.component';
import { BusyDirective } from '../../common/directives/busy/busy.directive';
import { BUSY } from '../../core/busy-keys';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { NumberFieldComponent } from '../../shared/forms/number-field/number-field.component';

@Component({
  selector: 'app-cardio-card',
  imports: [NumberFieldComponent, BusyDirective, IconComponent, TPipe],
  host: { class: 'card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (type()) {
      @case ('cardio') {
        <div class="card-head">
          <h3><app-icon name="heart" /> {{ 'dash.todaysCardio' | t }}</h3>
          @if (cardio().done) {
            <span class="badge badge-cardio"><app-icon name="check" size="sm" />{{ 'common.completed' | t }}</span>
          }
        </div>
        <div class="flex flex-wrap gap-1.5" style="margin-bottom: 12px">
          <button class="btn btn-sm" [class.btn-active]="cardio().type === 'walk'" [appBusy]="BUSY.cardio(k())" (click)="day.setCardio(k(), { type: 'walk' })">{{ 'dash.briskWalk2030' | t }}</button>
          <button class="btn btn-sm" [class.btn-active]="cardio().type === 'jog'" [appBusy]="BUSY.cardio(k())" (click)="day.setCardio(k(), { type: 'jog' })">{{ 'dash.easyJog2025' | t }}</button>
        </div>
        <div class="kv"><span>{{ 'dash.intensity' | t }}</span><b>{{ 'dash.zone2PaceYou' | t }}</b></div>
        <div class="kv"><span>{{ 'dash.pulse' | t }}</span><b>{{ 'dash.110135BeatsPer' | t }}</b></div>
        <div class="kv">
          <span>{{ 'dash.note' | t }}</span>
          <b>{{ cardio().type === 'jog' ? ('dash.ifYouFeelGroin' | t) : ('dash.inclinedTreadmill58' | t) }}</b>
        </div>
        <div class="flex flex-wrap items-center gap-2" style="margin-top: 12px">
          <label class="field" style="flex: 1" [appBusy]="BUSY.cardio(k())">
            {{ 'common.minutes' | t }}
            <app-number-field [value]="cardio().minutes" [placeholder]="cardio().type === 'jog' ? '20–25' : '20–30'" (change)="day.setCardio(k(), { minutes: val($event) })" />
          </label>
          <button class="btn" [class.btn-done]="cardio().done" [class.btn-primary]="!cardio().done" style="align-self: flex-end" [appBusy]="BUSY.toggle(k(), 'cardio')" (click)="day.toggleCardio(k())">
            <app-icon name="check" size="sm" />{{ cardio().done ? ('dash.done' | t) : ('dash.completeCardio' | t) }}
          </button>
        </div>
        <p class="text-muted" style="margin: 10px 0 0; font-size: 0.75rem">{{ 'dash.sinceMainGoalBuilding' | t }}</p>
      }
      @case ('rest') {
        <div class="card-head"><h3><app-icon name="moon" /> {{ 'dash.recoveryDay' | t }}</h3></div>
        <div class="kv"><span>{{ 'common.cardio' | t }}</span><b>{{ 'dash.noneRecovery' | t }}</b></div>
        <div class="kv"><span>{{ 'common.exercise' | t }}</span><b>{{ 'dash.easyWalk68' | t }}</b></div>
        <div class="kv"><span>{{ 'dash.mobility' | t }}</span><b>{{ 'dash.10MinOfStretching' | t }}</b></div>
        <div class="kv"><span>{{ 'dash.focus' | t }}</span><b>{{ 'dash.sleepWaterProtein' | t }}</b></div>
      }
      @default {
        <div class="card-head"><h3><app-icon name="heart" /> {{ 'dash.todaysCardio' | t }}</h3></div>
        <div class="empty">{{ 'dash.noSeparateCardioToday' | t }}<br />{{ 'dash.afterWorkoutYouCan' | t }}</div>
      }
    }
  `,
})
export class CardioCardComponent {
  protected readonly BUSY = BUSY;
  protected readonly val = inputValue;
  protected readonly day = inject(DayService);
  private readonly ui = inject(UiService);
  private readonly program = inject(ProgramService);
  private readonly store = inject(StoreService);

  protected readonly k = this.ui.viewDate;
  protected readonly type = computed(() => this.program.dayType(this.k()));
  protected readonly cardio = computed(() => (this.store.state().days[this.k()] ?? newDay()).cardio);
}
