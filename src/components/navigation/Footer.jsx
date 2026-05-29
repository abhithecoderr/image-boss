import React from "react";
import { Link } from "react-router-dom";
import Logo from "../ui/Logo";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Logo showIcon={true} />
          <p className="footer-description">
            The professional suite for AI-powered image editing.
          </p>
        </div>
        <div className="footer-links-grid">
          <div className="footer-column">
            <h4 className="footer-column-title">Product</h4>
            <Link to="/features" className="footer-link">
              Features
            </Link>
            <Link to="/pricing" className="footer-link">
              Pricing
            </Link>
            <Link to="/showcase" className="footer-link">
              Showcase
            </Link>
          </div>
          <div className="footer-column">
            <h4 className="footer-column-title">Company</h4>
            <Link to="/about" className="footer-link">
              About
            </Link>
            <Link to="/blog" className="footer-link">
              Blog
            </Link>
            <Link to="/careers" className="footer-link">
              Careers
            </Link>
          </div>
          <div className="footer-column">
            <h4 className="footer-column-title">Legal</h4>
            <Link to="/privacy" className="footer-link">
              Privacy Policy
            </Link>
            <Link to="/terms" className="footer-link">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} Image Boss. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default React.memo(Footer);
