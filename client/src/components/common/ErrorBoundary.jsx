import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          background: 'var(--bg-main)',
          color: 'var(--text-main)'
        }} className="view-animate">
          <div className="glass-card holographic" style={{ padding: '40px', maxWidth: '500px' }}>
            <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--primary)', marginBottom: '20px' }}>
              error_meditation
            </span>
            <h1 className="font-serif">The Spark Flicker...</h1>
            <p style={{ opacity: 0.8, marginBottom: '30px' }}>
              Something unexpected happened within the SPARK matrix. We've logged the incident and are working to restore the glow.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => window.location.reload()}
              style={{ width: '100%', padding: '15px' }}
            >
              Re-Ignite SPARK
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
