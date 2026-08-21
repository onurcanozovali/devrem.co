import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getProvinceName } from '@/data/turkeyProvinces';
import type { PreparationItem } from '@/features/preparation/types/preparation';
import { getMilitaryPeriodLabel, militaryTypeLabels } from '@/features/profile/profileOptions';
import { getImportantPreparationState, getReportingCountdown, getTimeBasedGreeting } from './homeDomain';

const referenceDate = new Date(2026, 7, 8, 23, 45);

function createItem(
  id: string,
  priority: PreparationItem['priority'],
  completed = false,
): PreparationItem {
  return {
    id,
    title: `Görev ${id}`,
    category: 'official',
    completed,
    source: 'default',
    sortOrder: Number(id),
    priority,
    helper: null,
    templateKey: id,
    templateVersion: 1,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
  };
}

describe('home reporting countdown', () => {
  it('counts tomorrow as one full local calendar day even late today', () => {
    assert.deepEqual(getReportingCountdown('2026-08-09', referenceDate), {
      state: 'future',
      daysRemaining: 1,
    });
  });

  it('counts future dates by local calendar day', () => {
    assert.deepEqual(getReportingCountdown('2026-08-20', referenceDate), {
      state: 'future',
      daysRemaining: 12,
    });
  });

  it('returns the today state without a negative value', () => {
    assert.deepEqual(getReportingCountdown('2026-08-08', referenceDate), {
      state: 'today',
      daysRemaining: 0,
    });
  });

  it('handles invalid and past dates without exposing negative days', () => {
    assert.deepEqual(getReportingCountdown('2026-02-30', referenceDate), {
      state: 'unavailable',
      daysRemaining: null,
    });
    assert.deepEqual(getReportingCountdown('2026-08-01', referenceDate), {
      state: 'past',
      daysRemaining: 0,
    });
  });
});

describe('home important preparation state', () => {
  it('counts all remaining important items and returns at most the first three', () => {
    const items = [
      createItem('1', 'important'),
      createItem('2', 'normal'),
      createItem('3', 'important', true),
      createItem('4', 'important'),
      createItem('5', 'important'),
      createItem('6', 'important'),
    ];

    const result = getImportantPreparationState(items);

    assert.equal(result.remainingCount, 4);
    assert.deepEqual(result.nextItems.map((item) => item.id), ['1', '4', '5']);
  });

  it('returns a calm empty state when every important item is complete', () => {
    const result = getImportantPreparationState([
      createItem('1', 'important', true),
      createItem('2', 'normal'),
    ]);

    assert.equal(result.remainingCount, 0);
    assert.deepEqual(result.nextItems, []);
  });
});

describe('home profile labels', () => {
  it('reuses the controlled Turkish city, military type, and celp labels', () => {
    assert.equal(getProvinceName(6), 'Ankara');
    assert.equal(militaryTypeLabels.standard, 'Er / Erbaş');
    assert.equal(militaryTypeLabels.paid, 'Bedelli');
    assert.equal(getMilitaryPeriodLabel(2026, 8), 'Ağustos 2026');
  });
});

describe('home greeting', () => {
  it('uses the required time windows', () => {
    assert.equal(getTimeBasedGreeting('Onur', new Date(2026, 7, 8, 5)), 'Günaydın, Onur');
    assert.equal(getTimeBasedGreeting('Onur', new Date(2026, 7, 8, 12)), 'Tünaydın, Onur');
    assert.equal(getTimeBasedGreeting('Onur', new Date(2026, 7, 8, 18)), 'İyi akşamlar, Onur');
    assert.equal(getTimeBasedGreeting('Onur', new Date(2026, 7, 8, 22)), 'İyi geceler, Onur');
  });
});
