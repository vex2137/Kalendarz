import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStoredSettings, saveStoredSettings } from '../src/utils/settingsStorage';
import { DEFAULT_THEME_COLORS, isCustomTheme, storedCustomThemes, BUILTIN_THEMES } from '../src/utils/themes';
import { memoryStorage } from './fixtures';
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage() });
const theme = { id: 'custom:test' as const, name: 'My theme', colors: { ...DEFAULT_THEME_COLORS, background: '#123456' } };

test('custom themes persist, can be edited and deleted, and all built-in themes remain selectable', () => {
  const settings = loadStoredSettings();
  saveStoredSettings({ ...settings, customThemes: [theme], theme: theme.id });
  assert.deepEqual(loadStoredSettings().customThemes, [theme]);
  assert.equal(loadStoredSettings().theme, theme.id);
  const edited = { ...theme, name: 'Edited', colors: { ...theme.colors, text: '#abcdef' } };
  saveStoredSettings({ ...settings, customThemes: [edited], theme: theme.id });
  assert.equal(loadStoredSettings().customThemes?.[0].colors.text, '#abcdef');
  for (const id of BUILTIN_THEMES) {
    saveStoredSettings({ ...settings, customThemes: [edited], theme: id });
    assert.equal(loadStoredSettings().theme, id);
  }
  saveStoredSettings({ ...settings, customThemes: [], theme: 'dark' });
  assert.deepEqual(loadStoredSettings().customThemes, []);
});
test('invalid CSS, missing colors, duplicate IDs and deleted selections are handled safely', () => {
  assert.equal(isCustomTheme({ ...theme, colors: { ...theme.colors, text: 'red;display:none' } }), false);
  assert.equal(isCustomTheme({ ...theme, colors: {} }), false);
  assert.equal(isCustomTheme({ ...theme, name: '' }), false);
  assert.equal(storedCustomThemes([theme, theme, { id: 'bad' }]).length, 1);
  assert.throws(() => saveStoredSettings({ ...loadStoredSettings(), theme: theme.id, customThemes: [] }));
  localStorage.setItem('offline_calendar_settings_v2', JSON.stringify({ theme: theme.id, customThemes: [{ ...theme, colors: {} }] }));
  assert.equal(loadStoredSettings().theme, 'dark');
  assert.deepEqual(loadStoredSettings().customThemes, []);
});
