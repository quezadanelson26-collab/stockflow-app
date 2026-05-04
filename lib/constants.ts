// ─── App Constants ──────────────────────────────────────
// Central place for magic numbers and config values.
// Update here instead of hunting through components.

export const APP_NAME = 'StockFlow';

// Inventory thresholds
export const LOW_STOCK_THRESHOLD = 10;

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Search
export const SEARCH_DEBOUNCE_MS = 300;

// Toast / notification duration (ms)
export const TOAST_DURATION = 4000;

// Date formats
export const DATE_FORMAT = 'en-US';

// PO statuses that allow editing
export const EDITABLE_PO_STATUSES = ['draft', 'submitted'] as const;

// PO statuses that allow receiving
export const RECEIVABLE_PO_STATUSES = ['submitted', 'partial'] as const;
