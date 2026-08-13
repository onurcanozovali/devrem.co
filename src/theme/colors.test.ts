import assert from 'node:assert/strict';
import test from 'node:test';

import { darkColors, lightColors, type ThemeColors } from './colors';

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function assertReadablePalette(name: string, colors: ThemeColors): void {
  const pairs = [
    ['primary text', colors.textPrimary, colors.background],
    ['secondary text', colors.textSecondary, colors.background],
    ['muted text', colors.textMuted, colors.background],
    ['placeholder', colors.placeholder, colors.inputBackground],
    ['primary action text', colors.textInverse, colors.primary],
    ['danger text', colors.danger, colors.background],
    ['outgoing chat text', colors.chatTextMine, colors.chatBubbleMine],
    ['incoming chat text', colors.chatTextOther, colors.chatBubbleOther],
    ['outgoing timestamp', colors.chatTimestampMine, colors.chatBubbleMine],
    ['incoming timestamp', colors.chatTimestampOther, colors.chatBubbleOther],
  ] as const;
  for (const [label, foreground, background] of pairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} ${label} must meet WCAG AA contrast`,
    );
  }
}

test('light and dark semantic palettes keep critical text at AA contrast', () => {
  assertReadablePalette('light', lightColors);
  assertReadablePalette('dark', darkColors);
});
