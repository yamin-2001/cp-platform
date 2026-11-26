import { createContext } from 'react'

/**
 * The context object lives in its own module so that `AppContext.jsx` only
 * exports components — required for React Fast Refresh to work correctly.
 */
export const AppContext = createContext(null)

export default AppContext
