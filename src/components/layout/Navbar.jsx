import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/services') || location.pathname.startsWith('/app');

  // If we are inside the app/dashboard, we might want a different navbar or none at all.
  // For now, let's keep a unified slim navbar for the marketing pages.
  if (isDashboard) return null; // Let the MainAppLayout handle the dashboard header if needed

  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}></span>
          Image Boss
        </Link>
        <div style={styles.links}>
          <Link to="/features" style={styles.link}>Features</Link>
          <Link to="/pricing" style={styles.link}>Pricing</Link>
          <Link to="/about" style={styles.link}>About</Link>
        </div>
        <div style={styles.actions}>
          <Link to="/login" style={styles.link}>Log In</Link>
          <Link to="/services" style={styles.cta}>Open App</Link>
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(13, 13, 13, 0.8)', // var(--bg-deep) with opacity
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-subtle)',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 var(--space-4)',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontWeight: '600',
    fontSize: '1.25rem',
    color: 'var(--text-main)',
  },
  logoIcon: {
    width: '24px',
    height: '24px',
    background: 'var(--accent-primary)',
    borderRadius: 'var(--radius-sm)',
  },
  links: {
    display: 'flex',
    gap: 'var(--space-5)',
  },
  link: {
    color: 'var(--text-muted)',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'color var(--transition-fast)',
  },
  actions: {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'center',
  },
  cta: {
    background: 'var(--text-main)',
    color: 'var(--bg-deep)',
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '500',
    fontSize: '14px',
    transition: 'opacity var(--transition-fast)',
  }
};

export default Navbar;
