// Phân bổ trang: Mở đầu 10%, C1 20%, C2 15%, C3 40%, C4 + Kết luận 15%; tổng luôn đúng bằng số trang
export type PageSectionKey = 'intro' | 'chapter1' | 'chapter2' | 'chapter3' | 'chapter4';
const PAGE_WEIGHTS: Record<PageSectionKey, number> = { intro: 0.10, chapter1: 0.20, chapter2: 0.15, chapter3: 0.40, chapter4: 0.15 };
const MIN_PAGE_LIMIT = 5;

export const parsePageLimit = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const pages = Math.round(Number(value));
  return Number.isFinite(pages) && pages >= MIN_PAGE_LIMIT ? pages : null;
};

export const allocatePages = (pages: number): Record<PageSectionKey, number> => {
  const keys = Object.keys(PAGE_WEIGHTS) as PageSectionKey[];
  const raw = keys.map(k => pages * PAGE_WEIGHTS[k]);
  const alloc = raw.map(v => Math.max(1, Math.floor(v)));
  let diff = pages - alloc.reduce((a, b) => a + b, 0);
  // Phân phần dư cho mục có phần lẻ lớn nhất; nếu thừa thì bớt ở mục lớn nhất (vẫn giữ tối thiểu 1 trang)
  const byRemainder = keys.map((_, i) => i).sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])));
  for (let i = 0; diff > 0; i = (i + 1) % keys.length, diff--) alloc[byRemainder[i]]++;
  while (diff < 0) {
    const largest = alloc.indexOf(Math.max(...alloc));
    if (alloc[largest] <= 1) break;
    alloc[largest]--;
    diff++;
  }
  return Object.fromEntries(keys.map((k, i) => [k, alloc[i]])) as Record<PageSectionKey, number>;
};
