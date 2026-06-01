import React from 'react';

/* 
 ValuePropSection:
 Highlights key product capabilities and tier structures (Mockups 2 & 3).
*/
export default function ValuePropSection() {
  return (
    <section className="home-value-prop-section">
      <div className="value-prop-header">
        <h2 className="value-prop-title">Designed for Next-Gen Workflows</h2>
        <p className="value-prop-subtitle">
          Experience maximum performance, total privacy, and unlimited capabilities
        </p>
      </div>

      <div className="value-prop-grid">
        {/* Card 1: Unlimited Local Processing (Mockup 2) */}
        <div className="value-prop-card">
          <div className="value-prop-info">
            <span className="value-prop-badge">Privacy First</span>
            <h3 className="value-prop-card-title">Unlimited Local Processing</h3>
            <p className="value-prop-card-desc">
              All AI tasks execute directly in your web browser utilizing WebGL, ONNX Runtime, and your device's GPU. 
              Your original images are never uploaded to our servers, guaranteeing 100% data privacy, zero server delays, 
              and zero monthly subscription limits for standard tasks.
            </p>
          </div>
          <div className="value-prop-graphic-box">
            <div className="pulse-glow"></div>
            <span className="value-prop-icon">💻</span>
          </div>
        </div>

        {/* Card 2: 10x Paid Cloud Boost (Mockup 3) */}
        <div className="value-prop-card reverse paid-boost">
          <div className="value-prop-info">
            <span className="value-prop-badge">Premium Boost</span>
            <h3 className="value-prop-card-title">10x Faster Cloud Execution</h3>
            <p className="value-prop-card-desc">
              Need extra speed or complex batch pipelines? Paid tier members get automated access to high-performance 
              cloud worker clusters. Evict large local models to offload memory, bypass local CPU thresholds, 
              and experience up to 10x faster execution speeds on ultra-high-resolution images.
            </p>
          </div>
          <div className="value-prop-graphic-box">
            <div className="pulse-glow"></div>
            <span className="value-prop-icon">⚡</span>
          </div>
        </div>
      </div>
    </section>
  );
}
