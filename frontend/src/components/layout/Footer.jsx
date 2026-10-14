import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
      &copy; {new Date().getFullYear()} CausalFunnel Inc. All rights reserved. &bull; Enterprise User Behavior Intelligence &amp; Session Analytics Platform
    </footer>
  );
}
