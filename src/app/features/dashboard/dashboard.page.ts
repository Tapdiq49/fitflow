import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StoreService } from '../../core/services/store.service';
import { IconComponent } from '../../shared/icon.component';
import { TPipe } from '../../shared/t.pipe';
import { BodyBasicsFormComponent } from '../profile/body-basics-form.component';
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
    SuppQuickComponent,
    BodyBasicsFormComponent,
    RouterLink,
    IconComponent,
    TPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-[18px]">
      <app-today-hero />
      <app-stat-cards />
      @if (store.bodySafetyIssue(); as issue) {
        <!-- A minor, or a BMI that needs a doctor: no generated menu or program; their own trainer plan is used. -->
        <div class="alert alert-bad" role="alert">
          <app-icon name="alert" />
          <div><b>{{ 'safety.title' | t }}</b> {{ (issue === 'minor' ? 'safety.minor' : 'safety.underweight') | t }} {{ 'safety.basis' | t: { bmi: store.currentBmi(), kg: store.currentWeight() } }} {{ 'safety.ownPlan' | t }} <a routerLink="/plan">{{ 'nav.weeklyPlan' | t }}</a></div>
        </div>
      }
      @if (store.bodyBasicsKnown()) {
        <app-meals-card />
      } @else {
        <!-- What to eat depends on height and weight, so no menu is shown before they are entered. -->
        <div class="card">
          <div class="card-head"><h3><app-icon name="utensils" /> {{ 'dash.todaysMeals' | t }}</h3></div>
          <div class="alert alert-info"><app-icon name="info" /><div class="w-full"><p style="margin: 0 0 10px"><b>{{ 'bodyBasics.title' | t }}</b> {{ 'bodyBasics.menuNeeds' | t }}</p><app-body-basics-form /></div></div>
        </div>
      }
      <section class="grid grid-cols-2 gap-4 tablet:grid-cols-1"><app-workout-summary /><app-cardio-card /></section>
      <section class="grid grid-cols-2 gap-4 tablet:grid-cols-1"><app-body-card /><app-weekly-card /></section>
      <section class="grid gap-4"><app-supp-quick /></section>
    </div>
  `,
})
export class DashboardPage {
  protected readonly store = inject(StoreService);
}
