# evoOS – Paleta: Tabla completa de notas (vista profesor)

Toda la plataforma usa la misma paleta que la **Tabla completa de notas** desde la vista de profesor.

## 1. Colores

| Uso | Hex | Ejemplo |
|-----|-----|--------|
| **Fondo (página)** | Radial: `#1E3A8A` → `#0F172A` → `#020617` | `radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)` |
| **Panel / card** | Glass | `linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))` + blur 20px + `border: 1px solid rgba(255,255,255,0.08)` + `box-shadow: 0 0 40px rgba(37,99,235,0.25)` |
| **Botón primario / tab activo** | `#3B82F6` | "Nueva asignación", "Vista completa" |
| **Hover primario** | `#2563EB` | Hover en botones y enlaces |
| **Gradiente tab activo** | `#3B82F6` → `#1D4ED8` | Mismo que en la tabla de notas |
| **Avatar / iconos destacados** | `#3B82F6` → `#1E40AF` | Círculos con iniciales |
| **Texto principal** | `#E2E8F0` | Títulos, nombres, contenido |
| **Texto secundario** | `white/70`, `white/60` | Descripciones |
| **Bordes** | `rgba(255,255,255,0.08)` – `0.10` | Paneles, tablas |

## 2. Clase global `.panel-grades`

Para repetir el estilo del panel de la tabla de notas en cualquier página:

```css
.panel-grades {
  background: linear-gradient(145deg, rgba(30, 58, 138, 0.35), rgba(15, 23, 42, 0.6));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 40px rgba(37, 99, 235, 0.25);
}
```

## 3. Variables CSS (`:root`)

- `--primary`: 217 91% 60% → `#3B82F6`
- `--primary-blue`, `--primary-blue-hover`, `--primary-blue-dark`, `--text-primary`, etc. en `index.css`

## 4. Reglas

- **Fondo global:** mismo radial que la tabla de notas (sin gradiente animado).
- **Cards/paneles:** usar `.panel-grades` o `.glass-enhanced` (ya alineados a esta paleta).
- **Botones primarios:** `#3B82F6`, hover `#2563EB`.
- **Enlace "Volver a...":** `#3B82F6`, hover `#2563EB`.
- **Tipografía:** `#E2E8F0` para texto principal; blanco para títulos fuertes.
- Mantener esta paleta en dashboards, notas, analíticas, login, AI Dock, Command Palette y resto de módulos.
