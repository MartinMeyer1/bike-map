import React from 'react'
import ReactDOM from 'react-dom/client'

// Self-hosted so the app's CSP can keep font-src at 'self'. Latin subset only:
// trail names run to French accents, which latin covers, and nothing in the UI
// needs Cyrillic or Greek. The weights are exactly those the design uses --
// sans 400/500/600/700 for copy, mono 400/500/600 for labels and numbers.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'

import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
