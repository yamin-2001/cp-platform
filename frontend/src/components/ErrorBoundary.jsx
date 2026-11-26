import React from 'react'
import { MdErrorOutline, MdRefresh } from 'react-icons/md'

/**
 * Catches render-time errors anywhere below it and shows a recoverable
 * error screen instead of blanking the whole app to a white page.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // In a real deployment this is where you'd report to Sentry etc.
    console.error('Uncaught UI error:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-6">
        <div className="card bg-base-200 border border-base-300 max-w-md w-full">
          <div className="card-body p-6 items-center text-center gap-4">
            <MdErrorOutline className="text-error" size={40} aria-hidden="true" />
            <div>
              <h1 className="font-display font-extrabold text-xl">Something went wrong</h1>
              <p className="text-muted text-sm mt-2">
                An unexpected error occurred while rendering this page.
              </p>
            </div>
            <pre className="text-left w-full text-[11px] text-muted bg-base-300 rounded-lg p-3 overflow-auto max-h-32">
              {error.message || String(error)}
            </pre>
            <button onClick={this.handleReset} className="btn btn-primary btn-sm gap-2">
              <MdRefresh size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
