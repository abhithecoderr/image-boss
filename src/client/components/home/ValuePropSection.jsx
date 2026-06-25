import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/* 
 ValuePropSection:
 Highlights key product capabilities, provides a workflow stepper, FAQ accordion, and final call-to-action.
*/
export default function ValuePropSection() {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "Does Image Boss upload my private photos to any servers?",
      a: "Absolutely not. By default, all operations (background removal, object erasing, cropping) run directly inside your web browser using WebGPU, WebGL, and WebAssembly. Your photos never leave your device."
    },
    {
      q: "Is there any limit on the size of images I can edit?",
      a: "For local browser processing, we enforce a maximum 5MB file upload limit for now to ensure smooth performance and prevent memory crashes. For larger images, we recommend utilizing our cloud processing boost."
    },
    {
      q: "Which browsers are supported?",
      a: "Image Boss runs on any modern browser supporting WebGPU, WebGL2, and WebAssembly. This includes Google Chrome, Microsoft Edge, Mozilla Firefox, and Apple Safari on desktop and mobile."
    },
    {
      q: "How does the Paid Cloud Boost tier work?",
      a: "If you need to process large batches of images at once or offload computation, the premium tier automatically delegates processing to our remote GPU worker clusters. The cloud offers faster inference with absolutely no load on your local device. We keep everything completely secure, and we never store your files."
    }
  ];

  return (
    <section className="home-value-prop-section animate-slide-up">
      {/* 1. Value Props Capabilities */}
      <div className="value-prop-header">
        <h2 className="value-prop-title">Designed for Next-Gen Workflows</h2>
        <p className="value-prop-subtitle">
          Experience maximum performance, total privacy, and unlimited capabilities
        </p>
      </div>

      <div className="value-prop-grid">
        {/* Card 1: Unlimited Local Processing */}
        <div className="value-prop-card">
          <div className="value-prop-info">
            <span className="value-prop-badge">Privacy First</span>
            <h3 className="value-prop-card-title">Unlimited Local Processing</h3>
            <p className="value-prop-card-desc">
              All AI tasks execute directly in your web browser utilizing WebGPU, WebGL, ONNX Runtime, and your device's GPU. 
              Your original images are never uploaded to our servers, guaranteeing 100% data privacy, zero server delays, 
              and zero monthly subscription limits for standard tasks.
            </p>
          </div>
          <div className="value-prop-graphic-box">
            <div className="pulse-glow"></div>
            <svg width="100%" height="100%" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '240px', position: 'relative', zIndex: 2 }}>
              {/* Laptop screen */}
              <rect x="40" y="30" width="160" height="96" rx="8" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="rgba(24, 24, 27, 0.6)" />
              {/* Laptop keyboard base */}
              <path d="M20 126H220L230 134H10L20 126Z" fill="#27272a" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.5" />
              {/* Laptop trackpad */}
              <rect x="105" y="129" width="30" height="3" rx="1.5" fill="rgba(255, 255, 255, 0.1)" />
              
              {/* Shield Icon (Privacy) */}
              <path d="M120 52C120 52 100 56 100 68C100 84 120 96 120 96C120 96 140 84 140 68C140 56 120 52 120 52Z" fill="var(--accent-soft)" stroke="var(--accent-primary)" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="120" cy="72" r="4" fill="var(--accent-primary)">
                <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
              </circle>
              
              {/* Orbiting execution indicators */}
              <circle cx="70" cy="55" r="10" fill="rgba(37, 99, 235, 0.1)" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="70" y="58" fill="#93c5fd" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="monospace">WASM</text>
              
              <circle cx="170" cy="90" r="10" fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth="1.5" />
              <text x="170" y="93" fill="#6ee7b7" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="monospace">GPU</text>
              
              {/* Link lines */}
              <path d="M80 58 L98 64" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M142 80 L160 86" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
          </div>
        </div>

        {/* Card 2: 10x Paid Cloud Boost */}
        <div className="value-prop-card reverse paid-boost">
          <div className="value-prop-info">
            <span className="value-prop-badge">Premium Boost</span>
            <h3 className="value-prop-card-title">10x Faster Cloud Execution</h3>
            <p className="value-prop-card-desc">
              Need extra speed or complex batch pipelines? Cloud boost offers significantly faster inference with absolutely no load on your device. We keep everything completely secure, and we never store your files. It's the perfect way to bypass local CPU/GPU thresholds and process large high-resolution images instantly.
            </p>
          </div>
          <div className="value-prop-graphic-box">
            <div className="pulse-glow"></div>
            <svg width="100%" height="100%" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '240px', position: 'relative', zIndex: 2 }}>
              {/* Central cloud icon */}
              <path d="M120 40C108 40 98 48 96 58C86 60 78 68 78 78C78 88 86 96 96 96H144C154 96 162 88 162 78C162 69 155 61 146 59C144 48 132 40 120 40Z" fill="var(--accent-secondary-soft)" stroke="var(--accent-secondary)" strokeWidth="2" />
              
              {/* Lightning strike */}
              <path d="M122 84L112 104H124L118 124L134 98H122L126 84Z" fill="var(--accent-secondary)" stroke="#a7f3d0" strokeWidth="1" />
              
              {/* Floating Speed particles */}
              <circle cx="60" cy="85" r="2" fill="var(--accent-secondary)">
                <animate attributeName="cx" values="60;100" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
              </circle>
              
              <circle cx="180" cy="65" r="1.5" fill="var(--accent-secondary)">
                <animate attributeName="cx" values="180;140" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
              </circle>
              
              <circle cx="100" cy="115" r="2.5" fill="var(--accent-secondary)">
                <animate attributeName="cy" values="115;80" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.8;0" dur="2.2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Step-by-Step Stepper */}
      <div className="stepper-section">
        <h3 className="section-subtitle-heading text-center">Three Simple Steps</h3>
        <div className="stepper-wrapper">
          <div className="stepper-step">
            <div className="step-number-circle">1</div>
            <h4 className="step-title">Load Locally</h4>
            <p className="step-desc">Drag and drop your image file. It loads directly in memory without server upload.</p>
          </div>
          <div className="stepper-line"></div>
          <div className="stepper-step">
            <div className="step-number-circle">2</div>
            <h4 className="step-title">AI Processing</h4>
            <p className="step-desc">Pick background removal or object erasing. Your device's GPU performs the magic.</p>
          </div>
          <div className="stepper-line"></div>
          <div className="stepper-step">
            <div className="step-number-circle">3</div>
            <h4 className="step-title">Instant Export</h4>
            <p className="step-desc">Download your edited photo instantly with lossless resolution and optimized quality.</p>
          </div>
        </div>
      </div>

      {/* 3. Interactive FAQ Section */}
      <div className="faq-section">
        <h3 className="section-subtitle-heading text-center">Frequently Asked Questions</h3>
        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`} onClick={() => toggleFaq(i)}>
              <div className="faq-question-bar">
                <span className="faq-question">{faq.q}</span>
                <span className="faq-toggle-icon">{openFaq === i ? '−' : '+'}</span>
              </div>
              <div className="faq-answer-wrapper">
                <div className="faq-answer">{faq.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Minimal final CTA banner */}
      <div className="cta-banner">
        <div className="cta-banner-content">
          <h3 className="cta-title">Ready to elevate your images?</h3>
          <p className="cta-desc">Start using browser-local AI processing tools immediately. No accounts needed for local tasks.</p>
          <Link to="/login" className="btn btn-primary btn-large cta-button">
            Launch Workspace <span style={{ marginLeft: '4px' }}>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
