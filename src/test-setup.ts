import { TestBed } from '@angular/core/testing';
import { AuthService } from './app/core/auth/auth.service';
import { FakeAuthService } from './app/core/auth/fake-auth.service';
import { loadLang, loadPack } from './app/core/i18n/translate';
import { FakeFoodRepository } from './app/core/repositories/fake-food.repository';
import { FakePlanRepository } from './app/core/repositories/fake-plan.repository';
import { FakeUserDataRepository } from './app/core/repositories/fake-user-data.repository';
import { FoodRepository } from './app/core/repositories/food.repository';
import { PlanRepository } from './app/core/repositories/plan.repository';
import { UserDataRepository } from './app/core/repositories/user-data.repository';

// English and Russian are loaded on demand in the app; the specs switch language freely, so they have them from the start.
beforeAll(async () => {
  await loadLang('en');
  await loadLang('ru');
  await loadPack('admin');
  await loadPack('plan');
  await loadPack('supp');
});

// What `app.config.ts` provides for the whole app: who is signed in (nobody: a guest) and where the account's data and weekly plans live. A spec that needs
// something else provides its own after this, which wins.
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useClass: FakeAuthService },
      { provide: UserDataRepository, useClass: FakeUserDataRepository },
      { provide: PlanRepository, useClass: FakePlanRepository },
      { provide: FoodRepository, useClass: FakeFoodRepository },
    ],
  });
});
