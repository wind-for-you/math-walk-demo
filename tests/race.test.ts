import { describe, it, expect } from 'vitest';
import { simulateRace, SHELL_RADIUS, RACE_BALL_COUNT } from '../src/race';

describe('simulateRace', () => {
  it('returns three balls with stable order for same seed', () => {
    const a = simulateRace(42);
    const b = simulateRace(42);
    expect(a.balls).toHaveLength(RACE_BALL_COUNT);
    expect(a.balls.map((x) => x.hitStep)).toEqual(b.balls.map((x) => x.hitStep));
    expect(a.winnerIndex).toBe(b.winnerIndex);
  });

  it('marks hit when radius crossed', () => {
    const r = simulateRace(7);
    for (const ball of r.balls) {
      if (ball.hitStep !== null) {
        const p = ball.walk.points[ball.hitStep]!;
        expect(p.x * p.x + p.y * p.y + p.z * p.z).toBeGreaterThanOrEqual(
          SHELL_RADIUS * SHELL_RADIUS,
        );
      }
    }
  });

  it('seed 1 has at least one hitter within steps', () => {
    // If this fails, lower SHELL_RADIUS in race.ts constants
    const r = simulateRace(1);
    expect(r.balls.some((b) => b.hitStep !== null)).toBe(true);
  });
});
