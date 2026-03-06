/**
 * evoOS - Misma paleta que Tabla completa de notas (vista profesor)
 * Fondo: radial #1E3A8A → #0F172A → #020617 | Panel: glass | Primario: #3B82F6 #2563EB
 */
export const theme = {
  colors: {
    deepDark: '#020617',
    midDark: '#0F172A',
    blueRadial: '#1E3A8A',
    primaryBlue: '#3B82F6',
    primaryBlueHover: '#2563EB',
    primaryBlueDark: '#1D4ED8',
    avatarBlue: '#1E40AF',
    textPrimary: '#E2E8F0',
    white: '#ffffff',
  },
  gradients: {
    background: 'radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)',
    panelGrades: 'linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6))',
    buttonPrimary: 'linear-gradient(180deg, #3B82F6, #1D4ED8)',
  },
  classes: {
    btnPrimary: 'bg-[#3B82F6] hover:bg-[#2563EB] text-white',
    panelGrades: 'panel-grades',
    cardGlow: 'shadow-[0_0_40px_rgba(37,99,235,0.25)]',
  },
} as const;
