/*
 * Deep-dive view describing features and capabilities of specific services.
 */
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SERVICES, SERVICE_ORDER } from "../config";
import ServiceIcon from "../components/ui/ServiceIcon";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [activeFaq, setActiveFaq] = useState(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);

  const activeServiceIds = SERVICE_ORDER.filter(id => !SERVICES[id]?.disabled);

  // Find active product
  const product = productId ? SERVICES[productId] : null;

  // SEO effects
  useEffect(() => {
    if (product) {
      document.title = `${product.name} - In-Browser AI Tool | Image Boss`;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute(
        "content",
        `${product.description}. Run state-of-the-art AI models completely locally in your browser. Zero uploads, maximum privacy.`
      );
    } else {
      document.title = "AI Products & Tools - local-first | Image Boss";
    }
  }, [product]);

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

  // Generate detailed blog content dynamically based on product id
  const getBlogContent = (id) => {
    switch (id) {
      case "background-removal":
        return {
          h1: "Professional Background Removal, Powered by Local AI",
          lead: "Say goodbye to complex clipping paths and expensive cloud APIs. Isolate people, products, and objects in seconds right inside your browser.",
          p1: "Our Background Removal tool utilizes state-of-the-art Deep Learning models optimized specifically for execution on consumer hardware via WebGPU. By processing the pixels directly in your graphic card's memory, we achieve studio-grade cutout precision without ever sending your photos to an external server.",
          p2: "Whether you are listing items on eBay, creating graphics for a social campaign, or assembling design assets, our local-first approach ensures that your pipeline remains incredibly fast and 100% private. Clean edges around hair, transparency preservation, and instant results make this the ultimate background remover.",
          features: [
            { title: "Hair & Edge Precision", desc: "Advanced mask refinement handles fine details like loose hair and fabric edges with ease." },
            { title: "Zero Upload Latency", desc: "No queue times or server delays. Process your high-res photos in milliseconds." },
            { title: "Transparent or Color Backdrops", desc: "Download as a transparent PNG or instantly composite onto a solid color canvas." }
          ],
          faqs: [
            { q: "What model does the background removal use?", a: "We run a highly optimized BiRefNet or InSPyReNet model in WebGPU. These models analyze contrast and boundaries to generate clean alpha channel masks." },
            { q: "Is there an image size limit?", a: "We support high-resolution photos. The processing speed depends on your device GPU, but standard 4K images are fully supported." }
          ]
        };
      case "magic-erase":
        return {
          h1: "AI Magic Erase: Wipe Away Clutter Instantly",
          lead: "Erase photobombers, power lines, text, and blemishes. Our local inpainting AI reconstructs the background like magic.",
          p1: "Magic Erase acts like a smart brush. Simply draw over any distracting object, and the underlying AI model analyzes the surrounding textures, lines, and lighting to fill in the missing space. No advanced Photoshop cloning skills required.",
          p2: "Operating completely client-side, the tool ensures high-resolution outputs with seamless boundary blending. From real estate photos requiring cleanup to personal vacation pictures, erase imperfections in seconds.",
          features: [
            { title: "Context-Aware Inpainting", desc: "Generates realistic details by understanding the context of your image backgrounds." },
            { title: "Brush Size Control", desc: "Adjust brush size for precision erasures or large sweeping cleanups." },
            { title: "Infinite Iterations", desc: "Erase multiple objects consecutively without losing original image detail." }
          ],
          faqs: [
            { q: "How does the AI know what was behind the object?", a: "The model uses LaMa (Resolution-robust Large Mask Inpainting) which has been trained on millions of diverse images to predict and generate matching texture patterns." },
            { q: "Can I undo an edit?", a: "Yes, our image editor supports full history state undo/redo cycles." }
          ]
        };
      case "object-segmentation":
        return {
          h1: "Extract & Manipulate Objects with Segment Anything (SAM)",
          lead: "Click on any item in your photo to isolate it. Create custom stickers, extract design layers, or erase specific regions.",
          p1: "Powered by Meta's Segment Anything (SAM 2.1) model, our object extractor changes how you interact with image elements. Rather than drawing complex vector loops, simply click on an object. The AI instantly snaps to its contours, creating a perfect selection.",
          p2: "This is ideal for collages, composite mockups, and complex graphic design workflows. By doing this locally via WebAssembly, you get zero-latency selection previews and complete control over mask thresholds.",
          features: [
            { title: "Point & Click Selection", desc: "Hover and click to instantly wrap complex objects with high-fidelity masks." },
            { title: "Multi-Object Masks", desc: "Combine multiple selections to extract groups of items together." },
            { title: "Cutout Export", desc: "Isolate selections and export them as transparent PNG stickers instantly." }
          ],
          faqs: [
            { q: "What is SAM?", a: "Segment Anything Model (SAM) is a foundation model from Meta AI that can segment any object in any image without specific training." },
            { q: "Can it select multiple objects at once?", a: "Yes, you can drop positive and negative prompt points to refine the selection, or add multiple items to the export queue." }
          ]
        };
      default:
        return {
          h1: `Enhance images with our ${product?.name || "AI"} tool`,
          lead: `${product?.description || ""}. Local-first AI running entirely in your browser.`,
          p1: "Our application hosts state-of-the-art machine learning models directly in the client sandbox. Using advanced web technologies like WebGPU, WASM, and Web Workers, we deliver professional-grade image processing without cloud dependencies, data logs, or subscription walls.",
          p2: "Experience the future of photo editing. Enhance details, redact private data, or convert file formats with unmatched speed, offline support, and absolute security.",
          features: [
            { title: "100% Data Privacy", desc: "Images never leave your machine. Processing happens entirely in-memory in your browser." },
            { title: "Local Hardware Acceleration", desc: "Leverage WebGPU to accelerate AI inferences using your system's graphics card." },
            { title: "Batch Processing Support", desc: "Run your editing workflows on single images or automate them across large batches." }
          ],
          faqs: [
            { q: "Does this require an internet connection?", a: "Only for the initial model download! Once the model is cached in your browser storage, the tool operates 100% offline." },
            { q: "Is this tool free to use?", a: "Yes, all our local browser-based tools are completely free to run on your own hardware." }
          ]
        };
    }
  };

  // Render Visual Comparison based on product
  const renderShowcase = (id) => {
    // We will build elegant interactive CSS before-after showcases
    let beforeStyle = {};
    let afterStyle = {};
    let beforeElement = null;
    let afterElement = null;

    switch (id) {
      case "background-removal":
        beforeStyle = {
          background: "radial-gradient(circle, #ff6b6b 0%, #4ecdc4 100%)",
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
          <div className="showcase-content-wrapper" style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="showcase-grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.2, background: "repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #fff, #fff 1px, transparent 1px, transparent 20px)" }} />
            <div className="showcase-circle" style={{ width: "120px", height: "120px", borderRadius: "50%", background: "linear-gradient(45deg, #f39c12, #d35400)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>
              📦
            </div>
          </div>
        );
        afterElement = (
          <div className="showcase-circle" style={{ width: "120px", height: "120px", borderRadius: "50%", background: "linear-gradient(45deg, #f39c12, #d35400)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>
            📦
          </div>
        );
        break;

      case "upscaling":
        beforeStyle = {
          background: "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: "blur(6px)",
        };
        afterStyle = {
          background: "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
        const textElement = (
          <div style={{ color: "#fff", textAlign: "center", fontFamily: "monospace" }}>
            <div style={{ fontSize: "3rem", fontWeight: "900", letterSpacing: "1px" }}>HD</div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", opacity: 0.8 }}>Resolution</div>
          </div>
        );
        beforeElement = textElement;
        afterElement = textElement;
        break;

      case "line-art":
        beforeStyle = {
          background: "linear-gradient(45deg, #e74c3c 0%, #9b59b6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
        afterStyle = {
          background: "#121214",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        };
        beforeElement = <span style={{ fontSize: "5rem" }}>🌸</span>;
        afterElement = (
          <div style={{ border: "2px solid #fff", borderRadius: "50%", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem", color: "#fff", background: "transparent", animation: "dash 5s linear infinite" }}>
            🌸
          </div>
        );
        break;

      case "blur":
        beforeStyle = {
          background: "linear-gradient(135deg, #1abc9c 0%, #2ecc71 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        afterStyle = {
          background: "linear-gradient(135deg, #1abc9c 0%, #2ecc71 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        };
        beforeElement = <span style={{ fontSize: "5rem" }}>👤</span>;
        afterElement = (
          <div style={{ position: "relative" }}>
            <span style={{ fontSize: "5rem" }}>👤</span>
            <div style={{ position: "absolute", top: "15px", left: "15px", width: "50px", height: "50px", borderRadius: "50%", backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }} />
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
        beforeElement = <span style={{ fontSize: "4rem", filter: "opacity(0.5)" }}>BEFORE</span>;
        afterElement = <span style={{ fontSize: "4rem", color: "var(--accent-primary)" }}>AFTER</span>;
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

  // 1. PRODUCT OVERVIEW PAGE
  if (!product) {
    return (
      <div className="product-page marketing-container page-transition">
        <section className="product-overview-hero">
          <div className="hero-glow" />
          <span className="overview-badge">PRODUCT SUITE</span>
          <h1>Local AI Image Tools</h1>
          <p>
            Explore our state-of-the-art suite of AI models designed to run 100% locally on your computer. 
            No cloud processing, no subscriptions, and absolute data privacy.
          </p>
        </section>

        <section className="product-overview-grid">
          {activeServiceIds.map((id) => {
            const service = SERVICES[id];
            return (
              <div key={id} className="product-overview-card" onClick={() => navigate(`/product/${id}`)}>
                <div className="card-icon-wrapper">
                  <ServiceIcon id={id} />
                </div>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <div className="card-footer">
                  <span className="learn-more">Learn More ➔</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  // 2. DEDICATED PRODUCT DETAILS PAGE
  const blog = getBlogContent(productId);

  return (
    <div className="product-page marketing-container page-transition">
      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        <Link to="/">Home</Link>
        <span className="separator">/</span>
        <Link to="/product">Product</Link>
        <span className="separator">/</span>
        <span className="current">{product.name}</span>
      </div>

      {/* Hero Layout */}
      <section className="product-hero-layout">
        <div className="product-hero-info">
          <span className="product-badge">
            <span className="badge-dot" /> LOCAL AI SERVICE
          </span>
          <h1>{product.name}</h1>
          <p className="tagline">{product.description}</p>
          <div className="hero-cta-group">
            <button 
              className="btn btn-primary btn-large glow-effect"
              onClick={() => navigate(`/services/${productId}`)}
            >
              Try {product.name} Now
            </button>
            <a href="#details" className="btn btn-secondary btn-large">
              Learn How It Works
            </a>
          </div>
          <div className="tech-meta">
            <div className="meta-item">
              <span className="meta-icon">💻</span>
              <span className="meta-text">Runs Locally (WebGPU/WASM)</span>
            </div>
            <div className="meta-item">
              <span className="meta-icon">🔒</span>
              <span className="meta-text">100% Private (No Uploads)</span>
            </div>
          </div>
        </div>

        {/* Visual Showcase Panel */}
        <div className="product-hero-visual">
          <div className="visual-card-wrapper">
            {renderShowcase(productId)}
            <div className="slider-instruction">
              Drag the slider to compare Before and After
            </div>
          </div>
        </div>
      </section>

      {/* Blog & Details Section */}
      <section id="details" className="product-details-article">
        <div className="article-main">
          <h2>{blog.h1}</h2>
          <p className="lead-paragraph">{blog.lead}</p>
          <p>{blog.p1}</p>
          <p>{blog.p2}</p>

          <div className="features-highlight-grid">
            {blog.features.map((f, i) => (
              <div key={i} className="feature-highlight-card">
                <div className="feature-highlight-number">0{i + 1}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Info Card */}
        <aside className="article-sidebar">
          <div className="sidebar-card">
            <h4>Technical Specs</h4>
            <div className="spec-list">
              <div className="spec-row">
                <span className="spec-label">Execution:</span>
                <span className="spec-value">In-browser local</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Acceleration:</span>
                <span className="spec-value">{product.device === "webgpu" ? "WebGPU (GPU)" : "WASM (CPU)"}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Data Transit:</span>
                <span className="spec-value">None (0 KB uploaded)</span>
              </div>
              {product.model && (
                <div className="spec-row">
                  <span className="spec-label">Model Size:</span>
                  <span className="spec-value">Optimized Mobile-Net</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      {/* FAQs Section */}
      <section className="product-faqs-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-accordion-group">
          {blog.faqs.map((faq, i) => (
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
      <section className="product-footer-cta">
        <div className="cta-glow" />
        <h2>Transform Your Images Offline Today</h2>
        <p>No account required to try. Open the workspace and start processing instantly.</p>
        <button 
          className="btn btn-primary btn-large"
          onClick={() => navigate(`/services/${productId}`)}
        >
          Open Background Remover
        </button>
      </section>
    </div>
  );
}
