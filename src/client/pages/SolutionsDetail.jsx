import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SOLUTIONS, SOLUTIONS_ORDER, SERVICES } from "../config";
import ServiceIcon from "../components/ui/ServiceIcon";

export default function SolutionsDetail() {
  const { solutionId } = useParams();
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);

  // Find active solution
  const solution = solutionId ? SOLUTIONS[solutionId] : null;

  // SEO effects
  useEffect(() => {
    if (solution) {
      document.title = `${solution.name} Solutions | Image Boss`;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute(
        "content",
        `${solution.description} Learn how our offline, browser-local AI tools help your workflow. 100% private and secure.`
      );
    } else {
      document.title = "Industry AI Solutions & Workflows | Image Boss";
    }
  }, [solution]);

  // Handle Before/After slider drag
  const handleMove = (clientX, rect) => {
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleTouchMove = (e) => {
    if (!isResizing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.touches[0].clientX, rect);
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.clientX, rect);
  };

  // Render Visual Comparison based on solution ID
  const renderShowcase = (id) => {
    let beforeStyle = {};
    let afterStyle = {};
    let beforeElement = null;
    let afterElement = null;

    switch (id) {
      case "ecommerce":
        beforeStyle = {
          background: "radial-gradient(circle, #e67e22 0%, #2c3e50 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "var(--checkerboard-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = (
          <div style={{ textAlign: "center", color: "#fff" }}>
            <span style={{ fontSize: "5rem" }}>👜</span>
            <div style={{ fontSize: "11px", opacity: 0.6 }}>Cluttered Studio Background</div>
          </div>
        );
        afterElement = (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "5rem" }}>👜</span>
            <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Isolated PNG Transparent</div>
          </div>
        );
        break;

      case "real-estate":
        beforeStyle = {
          background: "linear-gradient(135deg, #16a085 0%, #2c3e50 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "linear-gradient(135deg, #16a085 0%, #2c3e50 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = (
          <div style={{ position: "relative", textAlign: "center" }}>
            <span style={{ fontSize: "5rem" }}>🏠</span>
            {/* Clutter items */}
            <span style={{ position: "absolute", bottom: "-10px", right: "-20px", fontSize: "1.5rem" }}>📦</span>
            <span style={{ position: "absolute", top: "10px", left: "-20px", fontSize: "1.5rem" }}>🔌</span>
          </div>
        );
        afterElement = (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "5rem" }}>🏠</span>
            <div style={{ fontSize: "11px", color: "#2ecc71" }}>✓ Clutter Removed</div>
          </div>
        );
        break;

      case "social-media":
        beforeStyle = {
          background: "linear-gradient(45deg, #8e44ad 0%, #3498db 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "linear-gradient(45deg, #8e44ad 0%, #3498db 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = <span style={{ fontSize: "5rem" }}>📸</span>;
        afterElement = (
          <div style={{ position: "relative", textAlign: "center" }}>
            <span style={{ fontSize: "5rem" }}>📸</span>
            <div className="caption-overlay" style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.8)", padding: "4px 8px", borderRadius: "4px", fontSize: "9px", color: "#fff", width: "160px", border: "1px solid rgba(255,255,255,0.2)" }}>
              "A high-quality photo of a modern camera under studio lights"
            </div>
          </div>
        );
        break;

      case "creative-studios":
        beforeStyle = {
          background: "linear-gradient(135deg, #ff7979 0%, #7098da 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "#121214",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = <span style={{ fontSize: "5rem" }}>🎨</span>;
        afterElement = (
          <div style={{ border: "2px dashed #fff", padding: "16px", borderRadius: "8px", fontSize: "3rem", color: "#fff" }}>
            🎨
          </div>
        );
        break;

      case "privacy-redaction":
        beforeStyle = {
          background: "linear-gradient(45deg, #2c3e50 0%, #bdc3c7 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "linear-gradient(45deg, #2c3e50 0%, #bdc3c7 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = (
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ fontSize: "3rem" }}>👱</span>
            <span style={{ fontSize: "3rem" }}>👧</span>
          </div>
        );
        afterElement = (
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ position: "relative" }}>
              <span style={{ fontSize: "3rem" }}>👱</span>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.3)" }} />
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ fontSize: "3rem" }}>👧</span>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.3)" }} />
            </div>
          </div>
        );
        break;

      default:
        beforeStyle = {
          background: "linear-gradient(45deg, #34495e 0%, #2c3e50 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "linear-gradient(45deg, #2c3e50 0%, #1a252f 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = <span style={{ fontSize: "4rem", filter: "opacity(0.5)" }}>RAW PHOTO</span>;
        afterElement = <span style={{ fontSize: "4rem", color: "var(--accent-primary)" }}>ENHANCED</span>;
        break;
    }

    return (
      <div 
        className="before-after-container"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseDown={() => setIsResizing(true)}
        onTouchStart={() => setIsResizing(true)}
        onMouseUp={() => setIsResizing(false)}
        onMouseLeave={() => setIsResizing(false)}
        onTouchEnd={() => setIsResizing(false)}
      >
        {/* Before Layer (Underneath) */}
        <div className="showcase-layer before-layer" style={beforeStyle}>
          {beforeElement}
          <div className="badge-label before-badge">Before</div>
        </div>

        {/* After Layer (Sliding overlay) */}
        <div 
          className="showcase-layer after-layer" 
          style={{ 
            ...afterStyle, 
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` 
          }}
        >
          {afterElement}
          <div className="badge-label after-badge">After</div>
        </div>

        {/* Slider Handle Line */}
        <div className="slider-handle" style={{ left: `${sliderPosition}%` }}>
          <div className="slider-handle-button">
            <span>◀</span>
            <span>▶</span>
          </div>
        </div>
      </div>
    );
  };

  // 1. SOLUTIONS OVERVIEW PAGE
  if (!solution) {
    return (
      <div className="solution-page marketing-container page-transition">
        <section className="solution-overview-hero">
          <div className="hero-glow" />
          <span className="overview-badge">SOLUTIONS SUITE</span>
          <h1>Tailored AI Workflows</h1>
          <p>
            Optimize your industry-specific task flows using local-first browser AI.
            Save hours of edit cycles and keep client photos completely confidential.
          </p>
        </section>

        <section className="solution-overview-grid">
          {SOLUTIONS_ORDER.map((id) => {
            const sol = SOLUTIONS[id];
            return (
              <div key={id} className="solution-overview-card" onClick={() => navigate(`/solutions/${id}`)}>
                <div className="card-icon-wrapper">
                  <ServiceIcon id={sol.icon} />
                </div>
                <h3>{sol.name}</h3>
                <p>{sol.description}</p>
                <div className="card-footer">
                  <span className="learn-more">Explore Solution ➔</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  // 2. DEDICATED SOLUTIONS DETAILS PAGE
  const targetService = SERVICES[solution.primaryService];

  return (
    <div className="solution-page marketing-container page-transition">
      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        <Link to="/">Home</Link>
        <span className="separator">/</span>
        <Link to="/solutions">Solutions</Link>
        <span className="separator">/</span>
        <span className="current">{solution.name}</span>
      </div>

      {/* Hero Layout */}
      <section className="solution-hero-layout">
        <div className="solution-hero-info">
          <span className="solution-badge">
            <span className="badge-dot" /> {solution.badge}
          </span>
          <h1>{solution.name}</h1>
          <p className="tagline">{solution.tagline}</p>
          <div className="hero-cta-group">
            <button 
              className="btn btn-primary btn-large glow-effect"
              onClick={() => navigate(`/services/${solution.primaryService}`)}
            >
              Try {targetService?.name || "Tool"} Now
            </button>
            <a href="#details" className="btn btn-secondary btn-large">
              See Case Details
            </a>
          </div>
          <div className="tech-meta">
            <div className="meta-item">
              <span className="meta-icon">💼</span>
              <span className="meta-text">Primary Tool: {targetService?.name}</span>
            </div>
            <div className="meta-item">
              <span className="meta-icon">🔒</span>
              <span className="meta-text">Secured Client Confidentiality</span>
            </div>
          </div>
        </div>

        {/* Visual Showcase Panel */}
        <div className="solution-hero-visual">
          <div className="visual-card-wrapper">
            {renderShowcase(solutionId)}
            <div className="slider-instruction">
              Drag the slider to preview the transformation
            </div>
          </div>
        </div>
      </section>

      {/* Blog & Case Studies Section */}
      <section id="details" className="solution-details-article">
        <div className="article-main">
          <h2>How {solution.name} Works in Image Boss</h2>
          <p className="lead-paragraph">{solution.content.overview}</p>
          
          <h3>The Challenge</h3>
          <p>{solution.content.problem}</p>
          
          <h3>Our Local AI Approach</h3>
          <p>{solution.content.solution}</p>

          <div className="features-highlight-grid">
            {solution.content.features.map((f, i) => (
              <div key={i} className="feature-highlight-card">
                <div className="feature-highlight-number">0{i + 1}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar details */}
        <aside className="article-sidebar">
          <div className="sidebar-card">
            <h4>Featured Workflow</h4>
            <div className="workflow-specs">
              <p>Combining multiple steps local-first:</p>
              <ul style={{ paddingLeft: "16px", margin: "10px 0", fontSize: "12px", color: "var(--text-muted)" }}>
                <li>Select and isolate primary subjects.</li>
                <li>Enhance edge contours or upscale textures.</li>
                <li>Compress and package assets for fast sharing.</li>
              </ul>
              <button 
                className="btn btn-secondary btn-full btn-tiny"
                style={{ marginTop: "12px" }}
                onClick={() => navigate(`/services/${solution.primaryService}`)}
              >
                Launch {targetService?.name || "Tool"}
              </button>
            </div>
          </div>
        </aside>
      </section>

      {/* FAQs Section */}
      <section className="solution-faqs-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-accordion-group">
          {solution.content.faqs.map((faq, i) => (
            <div 
              key={i} 
              className={`faq-accordion-item ${activeFaq === i ? "active" : ""}`}
              onClick={() => setActiveFaq(activeFaq === i ? null : i)}
            >
              <div className="faq-question-header">
                <h4>{faq.q}</h4>
                <span className="faq-toggle-icon">{activeFaq === i ? "−" : "+"}</span>
              </div>
              <div className="faq-answer-body">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="solution-footer-cta">
        <div className="cta-glow" />
        <h2>Supercharge Your Workflow Today</h2>
        <p>No credit card or cloud signup required. Process high-res images directly in-browser.</p>
        <button 
          className="btn btn-primary btn-large"
          onClick={() => navigate(`/services/${solution.primaryService}`)}
        >
          Get Started Now
        </button>
      </section>
    </div>
  );
}
