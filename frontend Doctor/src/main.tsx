import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'

// Dev-only Style Guide: `npm run dev`, then open /?styleguide. `import.meta.env.DEV` is a
// compile-time constant, so the guide and its chunk are removed from production builds.
const StyleGuide = import.meta.env.DEV ? lazy(() => import('./dev/StyleGuide.tsx')) : null
const showStyleGuide = StyleGuide !== null && new URLSearchParams(window.location.search).has('styleguide')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showStyleGuide && StyleGuide ? (
      <Suspense fallback={null}>
        <StyleGuide />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
