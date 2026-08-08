import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PREPARATION_CATEGORIES } from '../preparationCategories';
import { PREPARATION_TEMPLATE, PREPARATION_TEMPLATE_VERSION } from '../preparationTemplate';
import type { PreparationItem, PreparationTemplateItem } from '../types/preparation';
import {
  calculatePreparationSummary,
  getMissingDefaultItems,
  getNextPreparationSortOrder,
  getTemplateItemsIntroducedAfter,
  normalizePreparationTitle,
  selectMissingDefaultItems,
  selectTemplateItemsIntroducedAfter,
  validatePreparationTitle,
} from './preparationDomain';

function item(overrides: Partial<PreparationItem> = {}): PreparationItem {
  return {
    id: 'custom-1',
    title: 'Örnek görev',
    category: 'official',
    completed: false,
    source: 'custom',
    sortOrder: 100,
    priority: 'normal',
    helper: null,
    templateKey: null,
    templateVersion: null,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('preparation template', () => {
  it('has stable unique identifiers and covers every controlled category', () => {
    assert.equal(PREPARATION_TEMPLATE_VERSION, 1);
    assert.equal(PREPARATION_TEMPLATE.length, 30);
    assert.equal(new Set(PREPARATION_TEMPLATE.map((entry) => entry.id)).size, PREPARATION_TEMPLATE.length);
    assert.equal(new Set(PREPARATION_TEMPLATE.map((entry) => entry.templateKey)).size, PREPARATION_TEMPLATE.length);

    for (const category of PREPARATION_CATEGORIES) {
      const categoryItems = PREPARATION_TEMPLATE.filter((entry) => entry.category === category.id);
      assert.ok(categoryItems.length > 0, `${category.id} should have defaults`);
      const sortOrders = categoryItems.map((entry) => entry.sortOrder);
      assert.deepEqual(sortOrders, [...sortOrders].sort((left, right) => left - right));
      assert.equal(new Set(sortOrders).size, sortOrders.length);
    }
  });

  it('initializes the current version once and admits future version additions', () => {
    assert.equal(getTemplateItemsIntroducedAfter(0).length, PREPARATION_TEMPLATE.length);
    assert.equal(getTemplateItemsIntroducedAfter(PREPARATION_TEMPLATE_VERSION).length, 0);

    const templateBase = PREPARATION_TEMPLATE.at(0);
    assert.ok(templateBase);
    const futureItem: PreparationTemplateItem = {
      ...templateBase,
      id: 'default-future',
      templateKey: 'future',
      introducedInVersion: 2,
    };
    assert.deepEqual(
      selectTemplateItemsIntroducedAfter([...PREPARATION_TEMPLATE, futureItem], 1).map((entry) => entry.id),
      ['default-future'],
    );
  });

  it('restores only missing defaults and never selects custom items', () => {
    const firstDefault = PREPARATION_TEMPLATE.at(0);
    const secondDefault = PREPARATION_TEMPLATE.at(1);
    assert.ok(firstDefault);
    assert.ok(secondDefault);
    const missing = getMissingDefaultItems(new Set([firstDefault.id, 'custom-user-item']));
    assert.equal(missing.length, PREPARATION_TEMPLATE.length - 1);
    assert.ok(!missing.some((entry) => entry.id === firstDefault.id));

    const selected = selectMissingDefaultItems(
      PREPARATION_TEMPLATE.slice(0, 2),
      new Set([firstDefault.id, 'custom-user-item']),
    );
    assert.deepEqual(selected.map((entry) => entry.id), [secondDefault.id]);
  });
});

describe('preparation checklist domain', () => {
  it('calculates empty and populated progress safely', () => {
    assert.deepEqual(calculatePreparationSummary([]), {
      completed: 0,
      total: 0,
      percentage: 0,
      isEmpty: true,
    });
    assert.deepEqual(calculatePreparationSummary([
      item({ id: '1', completed: true }),
      item({ id: '2', completed: false }),
      item({ id: '3', completed: true }),
    ]), {
      completed: 2,
      total: 3,
      percentage: 67,
      isEmpty: false,
    });
  });

  it('appends custom items within their selected category', () => {
    assert.equal(getNextPreparationSortOrder([
      item({ id: '1', category: 'travel', sortOrder: 100 }),
      item({ id: '2', category: 'travel', sortOrder: 400 }),
      item({ id: '3', category: 'official', sortOrder: 900 }),
    ], 'travel'), 500);
    assert.equal(getNextPreparationSortOrder([], 'personal'), 100);
  });

  it('normalizes and bounds task titles', () => {
    assert.equal(normalizePreparationTitle('  Biletimi   al  '), 'Biletimi al');
    assert.equal(validatePreparationTitle('a'), 'Görev adı en az 2 karakter olmalı.');
    assert.equal(validatePreparationTitle('a'.repeat(101)), 'Görev adı en fazla 100 karakter olabilir.');
    assert.equal(validatePreparationTitle('Biletimi al'), null);
  });
});
