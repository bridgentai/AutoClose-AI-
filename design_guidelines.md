# AutoClose AI - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Material Design 3) with Educational Focus

**Justification:** AutoClose serves institutional clients requiring trust, professionalism, and multi-role interfaces. Material Design provides the structured component library needed for complex dashboards while maintaining accessibility and clarity across student, teacher, and administrative views.

**Key Principles:**
1. Institutional Trust - Professional, clean layouts that inspire confidence
2. Role-Based Clarity - Distinct visual hierarchies for different user types
3. AI-First Interface - Chat/conversational UI as the primary interaction model
4. Customizable Identity - Flexible branding system for each institution

---

## Typography

**Font System (Google Fonts):**
- **Primary:** Inter (UI elements, navigation, labels)
- **Display:** Poppins (headings, section titles, institutional branding)

**Hierarchy:**
- **Hero/Display:** text-5xl to text-6xl (Poppins SemiBold)
- **H1:** text-4xl (Poppins SemiBold)
- **H2:** text-3xl (Poppins Medium)
- **H3:** text-2xl (Poppins Medium)
- **Body Large:** text-lg (Inter Regular)
- **Body:** text-base (Inter Regular)
- **Small/Meta:** text-sm (Inter Regular)
- **Micro:** text-xs (Inter Medium for labels)

---

## Layout System

**Spacing Units:** Tailwind scale of 2, 3, 4, 6, 8, 12, 16, 20, 24
- Tight spacing: p-2, gap-3, m-4
- Standard spacing: p-6, gap-8, m-12
- Generous spacing: p-16, gap-20, py-24

**Grid System:**
- Desktop dashboards: 12-column grid with gap-6
- Content max-width: max-w-7xl for main layouts
- Sidebar: Fixed 280px (desktop), full-width drawer (mobile)
- Chat interface: max-w-4xl centered conversation area

---

## Core Component Library

**Navigation:**
- **Main App:** Persistent left sidebar (280px) with institutional logo, role-based menu items, and AI assistant quick access
- **Top Bar:** Institution name, user profile, notifications, settings
- **Mobile:** Hamburger menu with slide-out drawer

**Dashboard Layouts:**
- **Student View:** Card-based grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3) for courses/subjects
- **Teacher View:** Split layout - course list sidebar (320px) + main content area for materials/planning
- **Admin View:** Stats cards in 4-column grid + data tables with action menus

**Chat/AI Assistant:**
- Full-screen dedicated chat page with conversation history sidebar (240px)
- Message bubbles: User (right-aligned, rounded-2xl), AI (left-aligned, rounded-2xl)
- Input area: Fixed bottom with attachment button, text field (h-12), send button
- Context pills above input showing active subject/course context

**Cards:**
- Course cards: Elevated with shadow-md, rounded-xl, p-6
- Material cards: Compact design with icon, title, metadata (rounded-lg, p-4)
- Stat cards: Bordered with subtle shadow, rounded-lg, featuring large numbers and micro labels

**Forms:**
- Input fields: h-12, rounded-lg, border with focus states
- Labels: text-sm font-medium, mb-2
- Form sections: Space with gap-6 between field groups
- Submit buttons: Full-width on mobile, inline on desktop

**Data Display:**
- Tables: Striped rows, sticky headers, hover states on rows
- List items: py-4 with dividers, hover background transitions
- Empty states: Centered with illustration placeholder + descriptive text

---

## Images

**Hero Section (Marketing/Login Pages):**
- Large hero image showing diverse students collaborating with technology
- Dimension: Full-width, h-screen or min-h-[600px]
- Overlay: Gradient overlay for text legibility
- Placement: Landing page hero, login page background (blurred)

**Dashboard Imagery:**
- Institutional logo: Top-left sidebar (h-12 to h-16)
- Empty state illustrations: Centered in content areas when no data exists
- Course thumbnails: Aspect ratio 16:9, rounded-lg
- Profile avatars: rounded-full, h-10 w-10 (standard), h-16 w-16 (profile pages)

**AI Assistant Branding:**
- Custom institution AI avatar: rounded-full, h-12 w-12 in chat messages
- AI personality icon in sidebar navigation

**Note:** All buttons on hero images use backdrop-blur-md background treatment for clarity.

---

## Responsive Behavior

**Breakpoints:**
- Mobile: Base styles, single column layouts
- Tablet (md:): 2-column grids, collapsible sidebar to drawer
- Desktop (lg:): Full multi-column layouts, persistent sidebar

**Mobile Optimizations:**
- Bottom navigation bar for primary actions
- Swipeable course/subject cards
- Full-screen chat interface
- Collapsible filters and settings panels

---

## Accessibility Standards

- Minimum touch targets: 44px × 44px
- Focus indicators: 2px ring with offset
- ARIA labels on all interactive elements
- Keyboard navigation throughout
- Screen reader-friendly table markup
- Contrast ratios meeting WCAG AA standards