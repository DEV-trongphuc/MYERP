/**
 * Utilities for Vietnamese text normalization and fuzzy matching
 */

/**
 * Remove Vietnamese accents from a string
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .trim();
}

/**
 * Flexible match for Vietnamese text, names, emails, and phone numbers
 * 
 * Supports:
 * - Case-insensitive match
 * - Accented vs Unaccented match (e.g. "thuy trang" matches "Nguyễn Thị Thuỳ Trang")
 * - Multi-word out-of-order match (e.g. "trang nguyen" matches "Nguyễn Thị Thuỳ Trang")
 * - Phone numbers with or without leading 0, with or without spaces/dots/dashes
 */
export function flexibleMatch(target: string | null | undefined, search: string): boolean {
  if (!search || !search.trim()) return true;
  if (!target) return false;

  const cleanSearch = search.trim().toLowerCase();
  const cleanTarget = target.toLowerCase();

  // 1. Direct substring match
  if (cleanTarget.includes(cleanSearch)) return true;

  // 2. Unaccented match
  const unaccentedTarget = removeVietnameseAccents(target);
  const unaccentedSearch = removeVietnameseAccents(search);
  if (unaccentedTarget.includes(unaccentedSearch)) return true;

  // 3. Multi-word match (every search word must be found in target)
  const searchWords = unaccentedSearch.split(/\s+/).filter(Boolean);
  if (searchWords.length > 1) {
    const allWordsPresent = searchWords.every(word => unaccentedTarget.includes(word));
    if (allWordsPresent) return true;
  }

  // 4. Phone number matching (ignore spaces, dots, dashes, +84, leading 0)
  if (!cleanSearch.includes('@')) {
    const digitsSearch = cleanSearch.replace(/[^0-9]/g, '');
    const digitsTarget = cleanTarget.replace(/[^0-9]/g, '');
    if (digitsSearch.length >= 3 && digitsTarget.length >= 3) {
      if (digitsTarget.includes(digitsSearch)) return true;
      const normSearch = digitsSearch.startsWith('84') ? digitsSearch.slice(2) : (digitsSearch.startsWith('0') ? digitsSearch.slice(1) : digitsSearch);
      const normTarget = digitsTarget.startsWith('84') ? digitsTarget.slice(2) : (digitsTarget.startsWith('0') ? digitsTarget.slice(1) : digitsTarget);
      if (normTarget.includes(normSearch) || normSearch.includes(normTarget)) return true;
    }
  }

  return false;
}
