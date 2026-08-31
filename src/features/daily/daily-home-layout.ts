export const dailyHomeLayoutStorageKey = "orbitflo:daily-home-layout";

export type DailyHomeLayout = {
  quickCapture: boolean;
  momentum: boolean;
  suggestions: boolean;
  review: boolean;
};

export const defaultDailyHomeLayout: DailyHomeLayout = {
  quickCapture: true,
  momentum: true,
  suggestions: true,
  review: true,
};

export function loadDailyHomeLayout(): DailyHomeLayout {
  try {
    const storedLayout = window.localStorage.getItem(dailyHomeLayoutStorageKey);
    return storedLayout ? { ...defaultDailyHomeLayout, ...JSON.parse(storedLayout) } : defaultDailyHomeLayout;
  } catch {
    return defaultDailyHomeLayout;
  }
}

export function saveDailyHomeLayout(layout: DailyHomeLayout) {
  window.localStorage.setItem(dailyHomeLayoutStorageKey, JSON.stringify(layout));
}
