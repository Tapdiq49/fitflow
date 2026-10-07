import { bmiOf, bodyIssue, plausibleBody, suggestTargets } from './targets';

const MAN = { height: 180, weight: 75, age: 30, sex: 'male' as const };

describe('suggestTargets', () => {
  it('maintains with Mifflin-St Jeor × 1.55 and 1.8 g protein per kg', () => {
    expect(suggestTargets({ ...MAN, goal: 'maintain' })).toMatchObject({ maintenance: 2680, kcal: 2680, protein: 135, goal: 'maintain', goalChanged: false });
  });

  it('takes 20 % (at most 500 kcal) off to lose, with more protein', () => {
    expect(suggestTargets({ ...MAN, goal: 'lose' })).toMatchObject({ kcal: 2180, protein: 150 });
  });

  it('adds 10 % (250–400 kcal) to gain', () => {
    expect(suggestTargets({ ...MAN, goal: 'gain' })).toMatchObject({ kcal: 2950, protein: 135 });
  });

  it('uses the female constant', () => {
    expect(suggestTargets({ height: 165, weight: 60, age: 28, sex: 'female', goal: 'maintain' }).maintenance).toBe(2060); // (600 + 1031.25 - 140 - 161) × 1.55
  });

  it('never goes below the lowest calorie target the app accepts', () => {
    expect(suggestTargets({ height: 150, weight: 40, age: 80, sex: 'female', goal: 'maintain' }).kcal).toBe(1500);
  });

  it('does not let an underweight person lose weight: maintenance numbers and goalChanged', () => {
    const r = suggestTargets({ height: 180, weight: 55, age: 25, sex: 'male', goal: 'lose' });
    expect(bmiOf(180, 55)).toBeLessThan(18.5);
    expect(r).toMatchObject({ goal: 'maintain', goalChanged: true });
    expect(r.kcal).toBe(suggestTargets({ height: 180, weight: 55, age: 25, sex: 'male', goal: 'maintain' }).kcal);
  });

  it('counts protein on the weight at BMI 27 for a very heavy person, and stays inside the allowed range', () => {
    const r = suggestTargets({ height: 170, weight: 130, age: 40, sex: 'male', goal: 'lose' });
    expect(r.protein).toBe(155); // 27 × 1.7² = 78 kg × 2.0
    expect(r.protein).toBeLessThanOrEqual(300);
    expect(suggestTargets({ height: 160, weight: 45, age: 30, sex: 'female', goal: 'maintain' }).protein).toBeGreaterThanOrEqual(80);
  });
});

describe('bodyIssue', () => {
  it('refuses anyone under 18, whatever the body measures', () => {
    expect(bodyIssue(150, 30, 15)).toBe('minor');
    expect(bodyIssue(180, 75, 17)).toBe('minor');
    expect(bodyIssue(180, 75, 18)).toBeNull();
  });

  it('refuses an adult with a BMI below 16, but not one just above it', () => {
    expect(bodyIssue(180, 50, 25)).toBe('underweight'); // BMI 15.4
    expect(bodyIssue(180, 52, 25)).toBeNull(); // BMI 16.0
  });

  it('lets a normal adult through', () => {
    expect(bodyIssue(165, 60, 28)).toBeNull();
  });
});

describe('plausibleBody', () => {
  it('refuses a height and weight that cannot be one person, accepts the real extremes', () => {
    expect(plausibleBody(100, 300)).toBe(false); // BMI 300
    expect(plausibleBody(250, 30)).toBe(false); // BMI 4.8
    expect(plausibleBody(180, 75)).toBe(true);
    expect(plausibleBody(170, 55)).toBe(true);
    expect(plausibleBody(180, 190)).toBe(true); // BMI 58.6, a very heavy person
  });
});
