import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import {
  Archive, CheckCircle2, FileImage, FileText, Gauge, Layers, Lock, Plus,
  ShieldCheck, Sparkle, Star, Upload, Zap,
} from '../components/icons';

const FEATURES = [
  {
    icon: Layers,
    title: 'Merge PDFs in any order',
    text: 'Drop in as many files as you like, drag them into the sequence you want, and download one clean document.',
  },
  {
    icon: Gauge,
    title: 'Server-side image compression',
    text: 'Sharp does the work — real savings at a quality you choose, with optional resizing to exact pixel targets.',
  },
  {
    icon: FileImage,
    title: 'JPG, PNG and WEBP',
    text: 'Keep the original format or convert between them. Transparent PNGs are flattened safely when you pick JPEG.',
  },
  {
    icon: Archive,
    title: 'Download everything at once',
    text: 'Compress a batch and take home a single ZIP, or download each image one by one.',
  },
  {
    icon: ShieldCheck,
    title: 'Real file validation',
    text: 'Every upload is checked against its actual bytes, not its filename. Oversized or malformed files are rejected.',
  },
  {
    icon: Lock,
    title: 'Sessions in HttpOnly cookies',
    text: 'Your auth token is never readable by JavaScript, so it cannot be stolen by a page script.',
  },
];

const STEPS = [
  { title: 'Add your files', text: 'Drag them into the glass panel or pick them from your device. Nothing is stored on our servers.' },
  { title: 'Choose your settings', text: 'For images, dial in quality, output format and maximum dimensions with instant preview feedback.' },
  { title: 'Process & download', text: 'The server does the heavy lifting and hands the finished file straight back to your browser.' },
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
    <Reveal as="div" className={`glass glass-card faq-item${open ? ' open' : ''}`} delay={index * 40}>
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
          <span className="faq-icon" aria-hidden="true">
            <Plus style={{ width: 18, height: 18 }} />
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
  const [openFaq, setOpenFaq] = useState(0);
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* ---------------------------------------------------------------- *
       * HERO
       * ---------------------------------------------------------------- */}
      <section className="page page--top" aria-labelledby="hero-title">
        <div className="hero">
          {/* Floating PDF + image icons around the hero copy. */}
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit orbit--1"><FileText /></span>
            <span className="orbit orbit--2"><FileImage /></span>
            <span className="orbit orbit--3"><Layers /></span>
            <span className="orbit orbit--4"><Gauge /></span>
            <span className="orbit orbit--5"><Sparkle /></span>
            <span className="orbit orbit--6"><Zap /></span>
          </div>

          <p className="eyebrow">
            <Star style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-1px' }} /> NorthStar
          </p>

          <h1 id="hero-title">
            <span className="glow-text">NorthStar</span>
            <span className="line-2">PDF &amp; Image Tools</span>
          </h1>

          <p className="hero-sub">
            Merge PDFs and compress images quickly with a secure, modern workspace.
          </p>

          <div className="hero-actions">
            <Link className="glass-button glass-button--lg" to="/pdf-merger">
              <Layers />
              Merge PDFs
            </Link>
            <Link className="glass-button glass-button--ghost glass-button--lg" to="/image-compressor">
              <FileImage />
              Compress Images
            </Link>
          </div>

          <ul className="hero-points">
            <li><CheckCircle2 style={{ width: 15, height: 15 }} /> No install, no queue</li>
            <li><ShieldCheck style={{ width: 15, height: 15 }} /> Files never stored</li>
            <li><Zap style={{ width: 15, height: 15 }} /> Server-side processing</li>
            {isAuthenticated
              ? <li><CheckCircle2 style={{ width: 15, height: 15 }} /> Signed in</li>
              : <li><Lock style={{ width: 15, height: 15 }} /> Free account required</li>}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * FEATURES
       * ---------------------------------------------------------------- */}
      <section className="page section" id="features" aria-labelledby="features-title">
        <Reveal className="section-head">
          <p className="eyebrow">Features</p>
          <h2 className="section-title" id="features-title">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="section-sub">
            Two focused tools that do one job each and do it properly — backed by real validation,
            real accounts, and a UI that stays fast.
          </p>
        </Reveal>

        <div className="grid grid-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} className="glass-card feature-card" delay={index * 60}>
              <span className="feature-icon" aria-hidden="true">
                <feature.icon />
              </span>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-text">{feature.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * HOW IT WORKS
       * ---------------------------------------------------------------- */}
      <section className="page section" id="how-it-works" aria-labelledby="how-title">
        <Reveal className="section-head">
          <p className="eyebrow">How It Works</p>
          <h2 className="section-title" id="how-title">
            Three steps, about twenty seconds
          </h2>
          <p className="section-sub">
            No configuration, no manual conversion settings to get wrong.
          </p>
        </Reveal>

        <div className="grid grid-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} className="glass glass-card step" delay={index * 90}>
              <span className="step-num" aria-hidden="true">{index + 1}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-text">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * FAQ
       * ---------------------------------------------------------------- */}
      <section className="page section" id="faq" aria-labelledby="faq-title">
        <Reveal className="section-head">
          <p className="eyebrow">FAQ</p>
          <h2 className="section-title" id="faq-title">
            Questions, answered
          </h2>
          <p className="section-sub">
            The things people usually want to know about privacy, limits and accounts.
          </p>
        </Reveal>

        <div style={{ maxWidth: 780, margin: '0 auto' }}>
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
      </section>

      {/* ---------------------------------------------------------------- *
       * CTA
       * ---------------------------------------------------------------- */}
      <section className="page section" aria-label="Get started">
        <Reveal className="glass-panel cta-band">
          <div>
            <h2 className="cta-title">Start with a file</h2>
            <p className="cta-text">
              Create a free account, then add a PDF or a batch of images and get your result in seconds.
            </p>
          </div>
          <div className="row" style={{ gap: 11 }}>
            <Link className="glass-button" to="/pdf-merger">
              <Upload style={{ width: 17, height: 17 }} />
              Merge PDFs
            </Link>
            <Link className="glass-button glass-button--ghost" to="/image-compressor">
              <FileImage style={{ width: 17, height: 17 }} />
              Compress Images
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}

