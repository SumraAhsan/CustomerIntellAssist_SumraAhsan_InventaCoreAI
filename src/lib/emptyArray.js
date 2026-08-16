// A single stable empty-array reference for `useLiveQuery(...) ?? EMPTY_ARR`
// fallbacks. Using `?? []` inline creates a new array every render, which
// defeats useMemo/useCallback dependency comparisons — this constant fixes
// that without changing any behavior.
export const EMPTY_ARR = Object.freeze([]);
