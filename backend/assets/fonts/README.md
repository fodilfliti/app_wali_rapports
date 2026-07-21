# Bundled PDF fonts (deployed with wali-api for Linux/cPanel)

Rapport PDF export uses `registerPdfFonts()` → prefers **Tahoma / Arial** on the OS
(both Arabic and French/Latin). On cPanel those Windows fonts are missing, so we ship:

- `DejaVuSans.ttf` — Latin + Arabic (Bitstream Vera / DejaVu license)

Do not use Arabic-only faces (e.g. Noto Naskh) for credentials handouts: French labels break.
