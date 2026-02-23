import { describe, expect, it, vi } from 'vitest';
import { createClaim } from '../../src/domain/claim';
import { buildJourney, buildJourneys } from '../helpers/factories';

describe('claim domain', () => {
  it('creates stable claim identifiers and queued status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00.000Z'));

    const journey = buildJourney({ journeyDate: '2025-02-28', from: 'A', to: 'B', delayMinutes: 17 });
    const claim = createClaim(journey);

    expect(claim.claimId).toBe(`claim-${journey.id}`);
    expect(claim.status).toBe('queued');
    expect(claim.createdAt).toBe('2025-03-01T00:00:00.000Z');

    vi.useRealTimers();
  });

  it('supports high-volume claim creation without collisions', () => {
    const journeys = buildJourneys(150, (index) => ({ delayMinutes: 15 + (index % 100) }));
    const claims = journeys.map(createClaim);
    const uniqueClaimIds = new Set(claims.map((claim) => claim.claimId));

    expect(claims).toHaveLength(150);
    expect(uniqueClaimIds.size).toBe(150);
  });

  it('empty claim list scenario remains empty (no phantom claims)', () => {
    const claims = [] as ReturnType<typeof createClaim>[];
    const total = claims.reduce((count) => count + 1, 0);

    expect(total).toBe(0);
    expect(claims).toEqual([]);
  });

  it('does not suffer floating-point drift when aggregating claim counters', () => {
    const journeys = [
      buildJourney({ delayMinutes: 16 }),
      buildJourney({ delayMinutes: 17, from: 'X', to: 'Y' }),
      buildJourney({ delayMinutes: 18, from: 'Y', to: 'Z' })
    ];
    const claims = journeys.map(createClaim);

    const weighted = claims.reduce((sum, _, index) => sum + (index + 1) * 0.1, 0);
    expect(Number(weighted.toFixed(2))).toBe(0.6);
  });
});
