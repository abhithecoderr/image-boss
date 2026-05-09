import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Footer = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/services') || location.pathname.startsWith('/app');

  if (isDashboard) return null; // No footer in the app workspace

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.brand}>
          <div style={styles.logo}>Image Boss</div>
          <p style={styles.description}>
            The professional suite for AI-powered image editing.
          </p>
        </div>
        <div style={styles.linksGrid}>
          <div style={styles.column}>
            <h4 style={styles.columnTitle}>Product</h4>
            <Link to="/features" style={styles.link}>Features</Link>
            <Link to="/pricing" style={styles.link}>Pricing</Link>
            <Link to="/showcase" style={styles.link}>Showcase</Link>
          </div>
          <div style={styles.column}>
            <h4 style={styles.columnTitle}>Company</h4>
            <Link to="/about" style={styles.link}>About</Link>
            <Link to="/blog" style={styles.link}>Blog</Link>
            <Link to="/careers" style={styles.link}>Careers</Link>
          </div>
          <div style={styles.column}>
            <h4 style={styles.columnTitle}>Legal</h4>
            <Link to="/privacy" style={styles.link}>Privacy Policy</Link>
            <Link to="/terms" style={styles.link}>Terms of Service</Link>
          </div>
        </div>
      </div>
      <div style={styles.bottom}>
        <p>&copy; {new Date().getFullYear()} Image Boss. All rights reserved.</p>
      </div>
    </footer>
  );
};

const styles = {
  footer: {
    background: 'var(--bg-deep)',
    borderTop: '1px solid var(--border-subtle)',
    padding: 'var(--space-8) 0 var(--space-4) 0',
    marginTop: 'auto',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 var(--space-4)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'var(--space-8)',
    flexWrap: 'wrap',
  },
  brand: {
    maxWidth: '300px',
  },
  logo: {
    fontWeight: '600',
    fontSize: '1.25rem',
    color: 'var(--text-main)',
    marginBottom: 'var(--space-2)',
  },
  description: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  linksGrid: {
    display: 'flex',
    gap: 'var(--space-8)',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  },
  columnTitle: {
    color: 'var(--text-main)',
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: 'var(--space-2)',
  },
  link: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    transition: 'color var(--transition-fast)',
  },
  bottom: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: 'var(--space-4) var(--space-4) 0',
    marginTop: 'var(--space-8)',
    borderTop: '1px solid var(--border-subtle)',
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: '12px',
  }
};

export default Footer;
