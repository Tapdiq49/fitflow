import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TPipe } from '../../common/pipes/translate/t.pipe';
import { IconComponent } from '../../shared/icon/icon.component';

/** Shown when the role of the account may open no page of the menu at all. */
@Component({
  selector: 'app-no-access-page',
  imports: [IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card mx-auto max-w-[32rem] text-center">
      <div class="card-head justify-center"><h3><app-icon name="lock" /> {{ 'noAccess.title' | t }}</h3></div>
      <p class="text-text-2">{{ 'noAccess.text' | t }}</p>
    </div>
  `,
})
export class NoAccessPage {}
