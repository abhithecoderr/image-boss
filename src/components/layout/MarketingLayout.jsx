import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

/**
 * The MarketingLayout provides the "Big Website" shell.
 * It includes the global Navbar and Footer, and renders page content in between.
 */
const MarketingLayout = () => {
  return (
    <div className="marketing-layout" style={styles.layout}>
      <Navbar />
      <main style={styles.main}>
        {/* Outlet renders the matched child route (e.g., Landing, Pricing) */}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

const styles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--bg-deep)',
    color: 'var(--text-main)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  }
};

export default MarketingLayout;
