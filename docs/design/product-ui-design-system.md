# CodeStrike Product UI Design System

## Product principles

CodeStrike should feel like a calm, credible mobile product for university students. Screens lead with the current student goal, keep business state legible, and reveal secondary explanation only when it helps a decision. Product content, prototype controls, and engineering evidence are separate layers.

## Tokens

The source of truth is `apps/student-app/src/uni.scss`. The palette uses `#F5F7FA` canvas, white surfaces, `#14213D` primary text, `#667085` secondary text, `#2563EB` primary actions, and `#C9F43D` sparingly for CodeStrike identity. Semantic success, warning, and danger colors use low-saturation backgrounds and remain paired with text labels.

The product type scale is 12 px metadata, 13–14 px supporting text, 15–16 px body text, 18–20 px section headings, 22 px page-bar titles, and 26–28 px primary page goals. Sustained product copy should normally be at least 15 px. Use 4, 8, 12, 16, 20, 24, and 32 px spacing steps. Inner controls use 7–12 px radii, cards 14–18 px, and major surfaces at most 20 px. Shadows are reserved for the floating bottom navigation; ordinary cards use a border or background, not both decoration and elevation.

## Navigation and actions

The header is a compact white app bar with a 44 px back or brand target, one clear title, optional short context, and a subtle Prototype Lab entry where demo tooling is required. The bottom navigation uses labelled discover, people, calendar, and profile glyphs with a consistent stroke language, four targets above 50 px, a visible active state, and safe-area-aware content clearance. Primary actions are solid blue, secondary actions use a restrained tint or border, and destructive actions must be explicitly labelled and confirmed. Disabled actions retain readable reasons and do not rely on color alone.

## Forms, cards, and states

Inputs and pickers are at least 44 px high, show visible focus, and keep validation adjacent to the field. Cards group one coherent object; lists and spacing are preferred over nested cards. Status badges are compact, sentence-like labels used only when a state changes the student's decision. Loading, empty, error, and success states use `StatePanel` or inline feedback with a direct next step. Confirmation modals state the object and consequence.

## Accessibility

Interactive targets are at least 44 CSS px high. Text and controls require adequate contrast, readable wrapping at 320 px, non-color state labels, and active/pressed feedback. Meaningful images require alternative text. Critical actions must not sit beneath fixed navigation, and horizontal scrolling is limited to deliberate tab or demo-control rails.

## Responsive behavior

The required H5 review widths are 320, 390, 430, and 680 CSS px. Mobile product content uses a 16 px horizontal alignment line; 680 px layouts may increase this to 36-40 px or use two columns when reading order remains clear. Keep horizontal and top padding in declarations that remain valid when a legacy safe-area function is unsupported; isolate `constant()` and `env()` fallbacks to bottom-padding declarations. Long titles wrap in page content and truncate only in the compact app bar. H5 CSS and component behavior must remain compatible with mp-weixin.

## Prototype Lab boundary

Product screens do not lead with persona, scenario, Stable ID, or test-assertion text. Mock actor and scenario controls open from the compact header into a separate Prototype Lab sheet and require an explicit user click to reveal and another explicit click to change actor. Existing actor selection remains deterministic, URL parameters never grant role authority, and every privileged operation rechecks current Mock state. The interface states plainly that these controls are not real authentication or backend authorization.

## D1.1 browser acceptance

For every pilot page and required viewport, the production H5 review measures the content container padding and major element rectangles as well as the final product element against the fixed navigation rectangle after scrolling to the bottom. UI-05 additionally requires all four complete tab labels to fit and remain clickable at 320 px. Navigation acceptance checks both the visible text labels and rendered icon bounds; Prototype Lab acceptance covers open, explicit actor selection, disclaimer, and close behavior.
