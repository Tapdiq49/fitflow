import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BloatQuickComponent } from './bloat-quick.component';
import { BodyCardComponent } from './body-card.component';
import { CardioCardComponent } from './cardio-card.component';
import { MealsCardComponent } from './meals-card.component';
import { StatCardsComponent } from './stat-cards.component';
import { SuppQuickComponent } from './supp-quick.component';
import { TodayHeroComponent } from './today-hero.component';
import { WeeklyCardComponent } from './weekly-card.component';
import { WorkoutSummaryComponent } from './workout-summary.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    TodayHeroComponent,
    StatCardsComponent,
    MealsCardComponent,
    WorkoutSummaryComponent,
    CardioCardComponent,
    BodyCardComponent,
    WeeklyCardComponent,
    BloatQuickComponent,
    SuppQuickComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <app-today-hero />
      <app-stat-cards />
      <app-meals-card />
      <section class="grid grid-cols-2 gap-4 tablet:grid-cols-1"><app-workout-summary /><app-cardio-card /></section>
      <section class="grid grid-cols-2 gap-4 tablet:grid-cols-1"><app-body-card /><app-weekly-card /></section>
      <section class="grid grid-cols-2 gap-4 tablet:grid-cols-1"><app-bloat-quick /><app-supp-quick /></section>
    </div>
  `,
})
export class DashboardPage {}
