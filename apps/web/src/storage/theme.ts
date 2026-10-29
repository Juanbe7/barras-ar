export type Theme = "light" | "dark";

export interface ThemeStore {
  /** The theme in use: the saved choice, or the system's when none was made. */
  current(): Theme;
  /** Switches to the other theme and remembers the choice. */
  toggle(): Theme;
  /** Applies the saved choice, if any; without one the CSS follows the system. */
  applySaved(): void;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "barras-ar:theme";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function createThemeStore(
  storage: KeyValueStorage,
  systemPrefersDark: () => boolean,
  apply: (theme: Theme) => void,
): ThemeStore {
  function saved(): Theme | null {
    try {
      const value = storage.getItem(STORAGE_KEY);
      return isTheme(value) ? value : null;
    } catch {
      return null;
    }
  }

  function current(): Theme {
    return saved() ?? (systemPrefersDark() ? "dark" : "light");
  }

  function toggle(): Theme {
    const next: Theme = current() === "dark" ? "light" : "dark";
    try {
      storage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts until the page closes
    }
    apply(next);
    return next;
  }

  function applySaved(): void {
    const theme = saved();
    if (theme) apply(theme);
  }

  return { current, toggle, applySaved };
}
