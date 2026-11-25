import { fr } from './fr.js';

const strings = fr;

export function t(key, vars = {}) {
  const s = strings[key];
  if (s === undefined) return key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
