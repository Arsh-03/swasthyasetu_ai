import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Each Phosphor icon module ships all six weights. The design system uses only `regular`
 * (inactive) and `duotone` (active), so drop the other four from the icon definitions
 * at build time (~2/3 of every icon's bytes). If Phosphor ever changes its file format the
 * regex simply stops matching and the full icons are bundled: nothing breaks.
 */
function phosphorTwoWeights(): Plugin {
  const defs = /@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/
  const unusedWeight = /\n {2}\[\n {4}"(?:thin|light|bold|fill)",[\s\S]*?\n {2}\],?/g
  return {
    name: 'phosphor-two-weights',
    transform(code, id) {
      if (!defs.test(id)) return null
      return { code: code.replace(unusedWeight, ''), map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), phosphorTwoWeights()],
})
