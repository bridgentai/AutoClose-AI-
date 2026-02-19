/**
 * AutoClose AI - Identidad Visual GLC
 * Azul rey (#002366) dominante | Blanco (#ffffff) | Amarillo (#ffd700) detalles mínimos
 */
export const theme = {
  colors: {
    deepDark: '#0a0a2a',       // Azul oscuro profundo (fondo)
    royalBlue: '#002366',      // Azul rey institucional (dominante)
    blueMedium: '#003d7a',     // Azul medio (contrastes)
    electricBlue: '#1e3cff',   // Azul eléctrico (hover, acentos)
    white: '#ffffff',          // Blanco (fondos, tipografía)
    gold: '#ffd700',           // Amarillo (indicadores mínimos)
  },
  gradients: {
    background: 'linear-gradient(135deg, #0a0a2a 0%, #002366 25%, #003d7a 50%, #002366 75%, #0a0a2a 100%)',
    panelGlow: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.15))',
    buttonPrimary: 'linear-gradient(90deg, #002366, #1e3cff)',
  },
  // Clases Tailwind para uso directo (sin template literals para JIT)
  classes: {
    btnGradient: 'bg-gradient-to-r from-[#002366] to-[#1e3cff]',
    btnGradientHover: 'hover:from-[#003d99] hover:to-[#2d4fff]',
    textGradient: 'bg-gradient-to-r from-[#002366] via-[#1e3cff] to-[#00c8ff] bg-clip-text text-transparent',
    cardGlow: 'shadow-[0_0_40px_rgba(30,60,255,0.15)]',
  },
} as const;
