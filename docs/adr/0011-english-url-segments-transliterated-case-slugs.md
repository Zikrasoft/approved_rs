# URL segments are English, but case and work slugs stay transliterated

Route segments and service slugs on all sites are English (`/sr/services/brakes-suspension/`), built only through each app's `PathBuilder`. Case-study and work slugs (`velikij-servis-zamena-grm`, `mersedes-benz-gls`) stay transliterated Russian: Keystatic generates the slug from the Russian title (`slugField: 'title'`), so every new entry arrives transliterated, and a mix of two styles is worse than uniform transliteration.

## Considered Options

- **English case slugs with redirects**: built and rolled back for the reason above. To change it, change the Keystatic config first, then the slugs.
