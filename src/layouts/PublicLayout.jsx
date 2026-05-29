import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/navigation/Navbar";
import Footer from "../components/navigation/Footer";

/**
 * PublicLayout provides the outer site shell for public-facing pages
 * (Landing, Pricing, etc.). Includes global Navbar and Footer.
 */
const PublicLayout = () => {
  return (
    <div className="public-layout">
      <Navbar />
      <main className="public-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
