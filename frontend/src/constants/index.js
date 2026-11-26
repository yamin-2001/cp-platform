export const ROUTES = {
  LOGIN:          '/login',
  REGISTER:       '/register',
  DASHBOARD:      '/dashboard',
  SUGGESTIONS:    '/suggestions',
  PROBLEMS:       '/problems',
  PRACTICE_SETS:  '/practicesets',
  PRACTICE_SET:   '/practicesets/:id',
  PROFILE:        '/profile',
}

export const STRATEGY = {
  SMART:   'smart',
  UPSOLVE: 'upsolve',
  STRETCH: 'stretch',
  RANDOM:  'random',
}

export const PROBLEM_STATUS = {
  SOLVED:    'solved',
  ATTEMPTED: 'attempted',
  UNSOLVED:  'unsolved',
}

/** Minimum password length. Must match the backend's rule in
    `backend/utils/validate.js` (`isValidPassword`), otherwise a password
    the form accepts is rejected by the API with a contradicting message. */
export const MIN_PASSWORD_LENGTH = 8

/* ------------------------------------------------------------------ */
/*  Visual tokens                                                     */
/* ------------------------------------------------------------------ */

/** Difficulty → semantic text colour. */
export const DIFF_COLOR = {
  easy:   'text-success',
  medium: 'text-warning',
  hard:   'text-error',
  unrated: 'text-subtle',
}

/** Difficulty → daisyUI badge class.
    `unrated` uses an outline rather than `badge-ghost`: ghost paints its
    background with base-200, which is the same colour as the cards these
    badges sit on, so the chip would be invisible. */
export const DIFF_BADGE = {
  easy:   'badge-success',
  medium: 'badge-warning',
  hard:   'badge-error',
  unrated: 'badge-outline text-muted',
}

/** Difficulty → chart fill (CSS custom properties, theme-independent). */
export const DIFF_FILL = {
  easy:   'var(--color-chart-easy)',
  medium: 'var(--color-chart-medium)',
  hard:   'var(--color-chart-hard)',
  unrated: 'var(--color-base-300)',
}

/** Problem status → glyph + label. */
export const STATUS_META = {
  [PROBLEM_STATUS.SOLVED]:    { glyph: '●', label: 'Solved'    },
  [PROBLEM_STATUS.ATTEMPTED]: { glyph: '◑', label: 'Tried'     },
  [PROBLEM_STATUS.UNSOLVED]:  { glyph: '○', label: 'Unsolved'  },
  new:                          { glyph: '○', label: 'New'       },
}

/** Codeforces rank → text colour class. */
export const RANK_COLOR = {
  'newbie':                 'text-muted',
  'pupil':                  'text-success',
  'specialist':             'text-info',
  'expert':                 'text-primary',
  'candidate master':       'text-secondary',
  'master':                 'text-warning',
  'international master':   'text-warning',
  'grandmaster':            'text-error',
  'international grandmaster': 'text-error',
  'legendary grandmaster':  'text-error',
}

/** Build a practice-set detail path from a set id. */
export const practiceSetPath = (id) => `/practicesets/${id}`

/** The rating bounds the app works within. */
export const RATING_MIN = 800
export const RATING_MAX = 3500

/** Clamp a rating into the app's range, falling back to the minimum. */
export const clampRating = (n) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return RATING_MIN
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(num)))
}
