export function filterVisibleDirectConversationRows<Row extends { hidden: boolean }>(rows: readonly Row[]): readonly Row[] {
  return rows.filter((row) => !row.hidden);
}
