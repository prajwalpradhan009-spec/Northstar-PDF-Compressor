import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import {
  Archive, ArrowRight, Check, CheckCircle2, CloudUpload, Download, FileImage,
  FileText, Gauge, Layers, Lock, Minus, Plus, RotateCw, Scan, Scissors,
  ShieldCheck, Sliders, Sparkle, Star, Type, Upload, Wrench, Zap,
} from '../components/icons';

const TOOLKIT_ITEMS = [
  {
    icon: Scissors,
    name: 'PDF Split',
    desc: 'Extract specific page ranges or break large documents into individual standalone files.',
  },
  {
    icon: Sliders,
    name: 'Organize & Reorder',
    desc: 'Sort, resequence, or delete pages before finalizing your combined master document.',
  },
  {
    icon: RotateCw,
    name: 'Rotate PDF',
    desc: 'Instantly rotate portrait and landscape pages by 90, 180, or 270 degrees in batch.',
  },
  {
    icon: Layers,
    name: 'Extract Pages',
    desc: 'Select and export only the relevant chapters, tables, or sheets you need.',
  },
  {
    icon: FileImage,
    name: 'PDF to Image',
    desc: 'Render high-resolution vector PDF pages into crisp PNG, JPEG, or WebP graphics.',
  },
  {
    icon: FileText,
    name: 'Image to PDF',
    desc: 'Compile photos, documents, and paper scans into an elegant, standardized PDF portfolio.',
  },
  {
    icon: Type,
    name: 'PDF to Text',
    desc: 'Extract clean selectable plaintext from document pages without formatting artifacts.',
  },
  {
    icon: Scan,
    name: 'OCR Scanner',
    desc: 'Machine-learning optical character recognition for scanned receipts and paper archives.',
  },
  {
    icon: ShieldCheck,
    name: 'Watermark PDF',
    desc: 'Stamp confidential banners, company watermarks, or page number stamps securely.',
  },
  {
    icon: Lock,
    name: 'Protect PDF',
    desc: 'Add 256-bit AES encryption with password protection against unauthorized viewing.',
  },
];

const FAQS = [
  {
    q: 'Do my files get stored on your servers?',
    a: 'No. Uploads are held in memory only for the length of the request and discarded as soon as the response is sent. We keep counters for signed-in users — file counts and byte totals — but never the file contents.',
  },
  {
    q: 'Do I need an account to use the tools?',
    a: 'Yes. Both the PDF merger and the image compressor open only after you sign in or create a free account, and the dashboard that tracks your merges and compressions is part of the same account.',
  },
  {
    q: 'How is my password stored?',
    a: 'Passwords are hashed with bcrypt using twelve salt rounds before they ever reach the database. The plain-text password is never written anywhere, and there is no `password` field in the user model — only `passwordHash`.',
  },
  {
    q: 'Where is my session token kept?',
    a: 'In an HttpOnly, SameSite=Lax cookie issued by the server, with an expiry and a token version. JavaScript cannot read it, which is why it is not exposed to an XSS attack the way a localStorage token would be. Sessions end when you reload the page, so a refresh always asks you to sign in again.',
  },
  {
    q: 'Why did my compressed image get bigger?',
    a: 'That happens when a source image is already heavily optimized, or when it is a PNG with transparency being saved as a near-lossless PNG. Try a lower quality, choose JPEG or WEBP, or set a maximum width to shrink the pixel dimensions.',
  },
  {
    q: 'What are the upload limits?',
    a: 'The PDF merger accepts up to 20 files per merge, 50 MB each, and 1000 combined pages. The image compressor accepts up to 20 images per batch, 15 MB each. Custom dimensions are capped at 8000px on the longest edge.',
  },
];

function FaqItem({ item, open, onToggle, index }) {
  const buttonId = `faq-btn-${index}`;
  const panelId = `faq-panel-${index}`;

  return (
    <Reveal as="div" className={`faq-item${open ? ' open' : ''}`} delay={index * 35}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          className="faq-q"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{item.q}</span>
          <span className="faq-toggle-icon" aria-hidden="true">
            {open ? <Minus style={{ width: 18, height: 18 }} /> : <Plus style={{ width: 18, height: 18 }} />}
          </span>
        </button>
      </h3>
      <div className="faq-a" id={panelId} role="region" aria-labelledby={buttonId}>
        <div>
          <p>{item.a}</p>
        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  // First FAQ item expanded by default as requested in prompt and matching reference image
  const [openFaq, setOpenFaq] = useState(0);
  const { isAuthenticated } = useAuth();

  return (
    <div className="cinematic-home">
      {/* ==================================================================== *
       * SECTION 01 — MIDNIGHT GALAXY HERO
       * ==================================================================== */}
      <section className="theme-galaxy" aria-labelledby="galaxy-hero-title">
        {/* Layered mountain silhouettes at bottom with floating cosmic mist clouds */}
        <div className="galaxy-mountains" aria-hidden="true">
          <div className="galaxy-mist-clouds" />
          <svg viewBox="0 0 1440 280" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <path
              d="M0 280L0 190L120 150L260 210L420 130L600 230L780 140L940 200L1120 120L1300 210L1440 160L1440 280Z"
              fill="#061126"
              fillOpacity="0.8"
            />
            <path
              d="M0 280L0 230L160 180L320 240L500 170L700 250L880 180L1080 230L1260 170L1440 220L1440 280Z"
              fill="#06110C"
            />
          </svg>
        </div>

        <div className="galaxy-content">
          <Reveal>
            <div className="eyebrow-galaxy">
              <span>&#9699;</span>
              <span>NORTHSTAR / DIGITAL DOCUMENT TOOLS</span>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="galaxy-headline" id="galaxy-hero-title">
              <span className="line-1">YOUR FILES, YOUR FLOW.</span>

              <span className="line-3">REIMAGINED.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="galaxy-sub">
              Merge PDFs. Compress images. Move from file chaos to clarity.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="galaxy-actions">
              <Link to="/pdf-merger" className="galaxy-btn-primary">
                Merge PDFs &rarr;
              </Link>
              <Link to="/image-compressor" className="galaxy-btn-secondary">
                Compress Images
              </Link>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <ul className="galaxy-trust">
              <li>
                <Zap style={{ width: 16, height: 16 }} />
                <span>Fast Processing</span>
              </li>
              <li>
                <ShieldCheck style={{ width: 16, height: 16 }} />
                <span>Secure &amp; Private</span>
              </li>
              <li>
                <Sparkle style={{ width: 16, height: 16 }} />
                <span>No Installation</span>
              </li>
              <li>
                {isAuthenticated ? (
                  <>
                    <CheckCircle2 style={{ width: 16, height: 16 }} />
                    <span>Signed in</span>
                  </>
                ) : (
                  <>
                    <Lock style={{ width: 16, height: 16 }} />
                    <span>Free Account Required</span>
                  </>
                )}
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ==================================================================== *
       * SECTION 02 — FOREST LUXURY TOOLS
       * ==================================================================== */}
      <section className="theme-forest" id="toolkit" aria-labelledby="forest-title">
        <div id="features" style={{ position: 'relative', top: '-40px' }} />
        <div className="forest-container">
          <Reveal className="forest-header">
            <div className="eyebrow-forest">
              <span>&#9699;</span>
              <span>THE TOOLKIT</span>
            </div>
            <span className="forest-script">Work Smarter Not Harder</span>
            <h2 className="forest-title" id="forest-title">
              LESS FRICTION. <span className="line-done">MORE DONE.</span>
            </h2>
            <p className="forest-sub">
              Powerful tools for your documents and images &mdash; all in one place.
            </p>
          </Reveal>

          {/* Two Large Hero Panels */}
          <div className="forest-hero-grid">
            {/* Merge PDFs Hero Panel */}
            <Reveal className="forest-hero-card" delay={40}>
              <div className="forest-badge-row">
                <div className="forest-icon-pill">
                  <Layers style={{ width: 26, height: 26 }} />
                </div>
                <span className="forest-tag">PRIMARY TOOL</span>
              </div>
              <h3 className="forest-card-title">Merge PDFs</h3>
              <p className="forest-card-desc">
                Combine multiple PDF documents in exact order. Sequence files intuitively with
                drag-and-drop, and produce a unified file in seconds.
              </p>
              <ul className="forest-feature-list">
                <li><Check style={{ width: 16, height: 16 }} /> Drag-and-drop sequence ordering</li>
                <li><Check style={{ width: 16, height: 16 }} /> Lightning-fast in-memory processing</li>
                <li><Check style={{ width: 16, height: 16 }} /> Up to 20 files &amp; 1000 combined pages</li>
              </ul>
              <Link to="/pdf-merger" className="forest-btn">
                Open Merge Tool &rarr;
              </Link>
            </Reveal>

            {/* Image Compression Hero Panel */}
            <Reveal className="forest-hero-card" delay={100}>
              <div className="forest-badge-row">
                <div className="forest-icon-pill">
                  <FileImage style={{ width: 26, height: 26 }} />
                </div>
                <span className="forest-tag">PRIMARY TOOL</span>
              </div>
              <h3 className="forest-card-title">Image Compression</h3>
              <p className="forest-card-desc">
                Lossy &amp; lossless batch compression powered by Sharp. Reduce file sizes up to 90%
                while preserving maximum visual clarity.
              </p>
              <ul className="forest-feature-list">
                <li><Check style={{ width: 16, height: 16 }} /> JPG, PNG, and modern WebP formats</li>
                <li><Check style={{ width: 16, height: 16 }} /> Custom pixel dimension resizing</li>
                <li><Check style={{ width: 16, height: 16 }} /> Individual downloads or batch ZIP archive</li>
              </ul>
              <Link to="/image-compressor" className="forest-btn">
                Open Compressor &rarr;
              </Link>
            </Reveal>
          </div>

          {/* Extended Toolkit Capabilities Grid */}
          <div className="forest-toolkit-grid">
            {TOOLKIT_ITEMS.map((tool, idx) => (
              <Reveal key={tool.name} className="forest-tool-card" delay={140 + idx * 30}>
                <div className="forest-tool-icon">
                  <tool.icon style={{ width: 20, height: 20 }} />
                </div>
                <h4 className="forest-tool-name">{tool.name}</h4>
                <p className="forest-tool-text">{tool.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================================================================== *
       * SECTION 03 — EDITORIAL MINIMAL WORKFLOW
       * Directly inspired by the reference image
       * ==================================================================== */}
      <section className="theme-workflow" id="how-it-works" aria-labelledby="workflow-title">
        {/* Landscape Graphic: Craggy mountain peaks, crimson clouds, moon, and traveler */}
        <div className="workflow-landscape" aria-hidden="true">
          <svg viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            {/* Pale glowing moon in upper right with scroll parallax */}
            <g className="workflow-moon">
              <circle cx="1280" cy="190" r="85" fill="#FFF4EC" fillOpacity="0.75" />
              <circle cx="1280" cy="190" r="95" stroke="#FFE9DF" strokeWidth="1.5" strokeOpacity="0.4" />
            </g>

            {/* Left Mountain Crag */}
            <path
              d="M-40 900L-40 450L60 380L140 460L240 320L340 500L420 440L500 580L440 900Z"
              fill="#18181C"
            />
            {/* Left Billowing Crimson Clouds with scroll-driven billowing motion */}
            <g className="billowing-clouds-left">
              <path
                d="M-30 620 C20 540, 100 520, 160 570 C220 500, 320 510, 350 590 C420 540, 520 600, 480 720 C540 800, 460 900, 360 900 L-40 900Z"
                fill="#C8102E"
                fillOpacity="0.94"
              />
              <path
                d="M-20 700 C40 650, 120 660, 170 720 C230 670, 320 700, 340 780 C400 810, 380 900, 300 900 L-40 900Z"
                fill="#E62746"
                fillOpacity="0.85"
              />
            </g>

            {/* Right Mountain Cliff with Precipice */}
            <path
              d="M1480 900L1480 340L1410 320L1350 360L1260 480L1180 440L1090 560L1020 660L1120 900Z"
              fill="#18181C"
            />
            {/* Right Billowing Crimson Clouds with scroll-driven billowing motion */}
            <g className="billowing-clouds-right">
              <path
                d="M1000 900 C980 780, 1070 700, 1150 720 C1190 620, 1310 610, 1380 670 C1460 620, 1500 680, 1500 820 L1500 900Z"
                fill="#C8102E"
                fillOpacity="0.94"
              />
              <path
                d="M1080 900 C1100 800, 1200 780, 1260 840 C1320 790, 1420 810, 1460 900Z"
                fill="#A30D28"
                fillOpacity="0.9"
              />
            </g>

            {/* Tiny Lone Traveler Silhouette atop right cliff at (1410, 315) */}
            <g transform="translate(1402, 290)">
              {/* Head */}
              <circle cx="6" cy="4" r="3" fill="#18181C" />
              {/* Body */}
              <path d="M4 7L8 7L9 22L3 22Z" fill="#18181C" />
              {/* Flowing Red Cape */}
              <path d="M4 7C-4 12, -8 18, -12 24C-7 24, 2 20, 4 15Z" fill="#C8102E" />
            </g>
          </svg>
        </div>

        <div className="workflow-container">
          {/* Header Row */}
          <div className="workflow-header-row">
            <Reveal>
              <div className="eyebrow-workflow">
                <span>&#9699;</span>
                <span>HOW IT WORKS</span>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <div className="workflow-tag-right">
                <div>SIMPLE</div>
                <div>FAST</div>
                <div>SECURE</div>
              </div>
            </Reveal>
          </div>

          {/* Giant Editorial Serif Headline */}
          <Reveal delay={80}>
            <h2 className="workflow-headline" id="workflow-title">
              <span className="line-dark">THREE STEPS.</span>
              <span className="line-crimson">ZERO CHAOS.</span>
            </h2>
          </Reveal>

          <Reveal delay={120}>
            <p className="workflow-sub">
              Get your work done in just three simple steps. No complicated process. No confusion.
            </p>
            <div className="workflow-accent-dash" />
          </Reveal>

          {/* 3 Step Columns with Hairline Dividers */}
          <div className="workflow-steps-grid">
            {/* Step 01 */}
            <Reveal className="workflow-step-col" delay={140}>
              <div className="step-top-row">
                <span className="step-big-num">01</span>
                <span className="step-crimson-badge">
                  <CloudUpload style={{ width: 24, height: 24 }} />
                </span>
              </div>
              <h3 className="step-col-title">ADD YOUR FILES</h3>
              <p className="step-col-desc">
                Upload files using the existing file selection or drag-and-drop functionality.
              </p>
              <div className="step-col-dash" />
            </Reveal>

            <div className="workflow-v-divider" />

            {/* Step 02 */}
            <Reveal className="workflow-step-col" delay={200}>
              <div className="step-top-row">
                <span className="step-big-num">02</span>
                <span className="step-crimson-badge">
                  <Wrench style={{ width: 24, height: 24 }} />
                </span>
              </div>
              <h3 className="step-col-title">CHOOSE YOUR TOOL</h3>
              <p className="step-col-desc">
                Use the existing settings and controls for the selected operation.
              </p>
              <div className="step-col-dash" />
            </Reveal>

            <div className="workflow-v-divider" />

            {/* Step 03 */}
            <Reveal className="workflow-step-col" delay={260}>
              <div className="step-top-row">
                <span className="step-big-num">03</span>
                <span className="step-crimson-badge">
                  <Download style={{ width: 24, height: 24 }} />
                </span>
              </div>
              <h3 className="step-col-title">PROCESS AND DOWNLOAD</h3>
              <p className="step-col-desc">
                The real backend processing creates your file and you can download it instantly.
              </p>
              <div className="step-col-dash" />
            </Reveal>
          </div>

          {/* Scroll Down Indicator */}
          <div className="workflow-scroll-down" aria-hidden="true">
            <span>SCROLL DOWN</span>
            <div className="scroll-line-drop" />
          </div>
        </div>
      </section>

      {/* ==================================================================== *
       * SECTION 04 — DARK CINEMATIC FAQ
       * Directly inspired by the reference image bottom section
       * ==================================================================== */}
      <section className="theme-cinematic-faq" id="faq" aria-labelledby="faq-title">
        <div className="faq-cinematic-glow" aria-hidden="true" />

        <div className="faq-cinematic-grid">
          {/* Left Column: Heading and Editorial Typography */}
          <div className="faq-cinematic-left">
            <Reveal>
              <div className="eyebrow-faq">
                <span>&#9699;</span>
                <span>GOOD TO KNOW</span>
              </div>
            </Reveal>

            <Reveal delay={60}>
              <h2 className="faq-cinematic-title" id="faq-title">
                <span className="line-white">CLARITY.</span>
                <span className="line-crimson">WITHOUT COMPROMISE.</span>
              </h2>
            </Reveal>

            <Reveal delay={120}>
              <p className="faq-cinematic-desc">
                Quick answers to common questions. If you need more help, we&apos;re always here.
              </p>
            </Reveal>
          </div>

          {/* Right Column: Accordion Panels */}
          <div className="faq-cinematic-right">
            <div className="faq-list">
              {FAQS.map((item, index) => (
                <FaqItem
                  key={item.q}
                  item={item}
                  index={index}
                  open={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? -1 : index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== *
       * SECTION 05 — CINEMATIC BOTTOM CTA
       * ==================================================================== */}
      <section className="theme-cinematic-cta" aria-label="Get started">
        <div className="cinematic-cta-inner">
          <Reveal>
            <h2 className="cinematic-cta-title">
              Ready to streamline your documents?
            </h2>
          </Reveal>
          <Reveal delay={60}>
            <p className="cinematic-cta-sub">
              Merge PDFs and optimize images with zero software install, strict privacy,
              and instant server processing.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="galaxy-actions" style={{ marginBottom: 0 }}>
              <Link to="/pdf-merger" className="galaxy-btn-primary">
                Merge PDFs &rarr;
              </Link>
              <Link to="/image-compressor" className="galaxy-btn-secondary">
                Compress Images
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
