import React from 'react'

/**
 * Shared page shell: a vertically stacked column with a max width, so every
 * page uses the same spacing rhythm and content measure.
 */
const Page = ({ children, className = '', width = 'max-w-5xl' }) => (
  <div className={`flex flex-col gap-5 ${width} ${className}`}>
    {children}
  </div>
)

export default Page
