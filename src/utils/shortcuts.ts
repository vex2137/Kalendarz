export const shortcutActions = {
  year: ['1'], month: ['2'], week: ['3'], day: ['4'], agenda: ['5'],
  settings: ['s'], assistant: ['a'], search: ['q', '/'], updates: ['u'],
  import: ['i'], export: ['e'], today: ['t'], create: ['d'],
} as const;
export type ShortcutAction = keyof typeof shortcutActions;
export type ShortcutMap = Record<ShortcutAction, string[]>;
export type ShortcutContext = 'calendar' | 'assistant' | 'assistant-history' | 'settings';
export const shortcutContexts = (action: ShortcutAction): ShortcutContext[] => action === 'settings'
  ? ['calendar', 'assistant', 'assistant-history'] : action === 'search' ? ['calendar', 'settings', 'assistant-history'] : ['calendar'];
export const defaultShortcuts = (): ShortcutMap => Object.fromEntries(Object.entries(shortcutActions).map(([key, values]) => [key, [...values]])) as ShortcutMap;
export function shortcutKey(e: Pick<KeyboardEvent,'key'|'ctrlKey'|'altKey'|'shiftKey'|'metaKey'>): string | undefined {
  if (['Control','Shift','Alt','Meta','OS','Super','AltGraph','CapsLock','Dead','Process','Unidentified'].includes(e.key)) return;
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const shift = e.shiftKey && (/^[a-z]$/i.test(key) || e.ctrlKey || e.altKey || e.metaKey);
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.metaKey && 'Meta', shift && 'Shift', key].filter(Boolean).join('+');
}
export const reservedShortcut = (key: string) => /^(Alt\+(?:F4|Tab)|Ctrl\+Alt\+Delete|Meta\+Space|(?:Ctrl|Meta)\+(?:Shift\+)?(?:w|q|t|n|l|r|p|Tab)|(?:Ctrl|Meta)\+Shift\+(?:i|j|c)|F5|F11|F12)$/.test(key);
export const validShortcutKey = (key:string) => /^(?:Ctrl\+)?(?:Alt\+)?(?:Meta\+)?(?:Shift\+)?(?:[a-z0-9/.,;\[\]\\'`=\-]|Space|Escape|Enter|ArrowLeft|ArrowRight|F(?:[1-9]|1[0-2]))$/.test(key) && !reservedShortcut(key) && key!=='Escape';
export function shortcutConflicts(map: ShortcutMap) {
  const found: string[] = [], entries = Object.entries(map) as [ShortcutAction,string[]][];
  entries.forEach(([a, keys], i) => entries.slice(i+1).forEach(([b, other]) => {
    if (shortcutContexts(a).some(context => shortcutContexts(b).includes(context)))
      for (const key of keys) if (other.includes(key)) found.push(`${key}: ${a} / ${b}`);
  }));
  return found;
}
export function normalizedShortcuts(value?: Partial<ShortcutMap>): ShortcutMap {
  const map = defaultShortcuts();
  for (const action of Object.keys(map) as ShortcutAction[]) {
    const keys = value?.[action];
    if (Array.isArray(keys) && keys.length <= 8 && keys.every(k => typeof k === 'string' && validShortcutKey(k))) map[action] = [...new Set(keys)];
  }
  return shortcutConflicts(map).length ? defaultShortcuts() : map;
}
export function shortcutInput(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="searchbox"],[role="combobox"],[role="slider"],[role="spinbutton"],[data-shortcut-capture]'));
}
export function resolveShortcut(event: KeyboardEvent, map: ShortcutMap, context: ShortcutContext | undefined): ShortcutAction | undefined {
  if (!context || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 || shortcutInput(event.target) || window.getSelection()?.isCollapsed === false) return;
  if(['Enter',' '].includes(event.key)&&event.target instanceof Element&&event.target.closest('button,a[href],[role="button"]'))return;
  const key = shortcutKey(event);
  if (!key || reservedShortcut(key)) return;
  return (Object.keys(map) as ShortcutAction[]).find(action => shortcutContexts(action).includes(context) && map[action].includes(key));
}
