import { AuthError } from '../../common/interfaces/auth/auth.models';
import { applyUserDataChanges } from '../user-data';
import { StoredUserData, UserDataChanges, UserDataRepository } from './user-data.repository';

/** In-memory UserDataRepository for specs. `stored` is the database; set `failing` to simulate a backend that cannot be reached. */
export class FakeUserDataRepository extends UserDataRepository {
  stored: StoredUserData = { days: {}, weights: [], history: {} };
  failing = false;
  /** Every change that was accepted, in order. */
  calls: UserDataChanges[] = [];

  async load(): Promise<StoredUserData> {
    if (this.failing) throw new AuthError('network_error');
    return structuredClone(this.stored);
  }

  async apply(changes: UserDataChanges): Promise<void> {
    if (this.failing) throw new AuthError('network_error');
    this.calls.push(structuredClone(changes));
    this.stored = { ...this.stored, ...applyUserDataChanges({ ...this.stored }, changes) };
  }
}
