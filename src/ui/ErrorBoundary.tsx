import { Component, type ReactNode } from 'react'
import { log } from '../log'

interface Props { children: ReactNode; label: string; fallback?: (retry: () => void, err: Error) => ReactNode }
interface State { err: Error | null }

/** Keeps a crash in one subsystem (e.g. WebGL) from taking down the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }
  static getDerivedStateFromError(err: Error): State { return { err } }
  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    log.error('react.boundary', { boundary: this.props.label, message: err.message, stack: (info.componentStack ?? '').slice(0, 300) })
  }
  retry = () => this.setState({ err: null })
  render() {
    if (!this.state.err) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.retry, this.state.err)
    return (
      <div className="fatal" role="alert">
        <h2>Something went wrong</h2>
        <p>{this.props.label} hit an unexpected error. Your conversation is safe.</p>
        <button onClick={this.retry}>Try again</button>
      </div>
    )
  }
}
