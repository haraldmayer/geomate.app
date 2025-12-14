# Geomate - Agent Development Guide

## Project Overview

Geomate is an interactive guide to Vienna's neighborhoods (called "Grätzl" in Viennese dialect). The application features an interactive map where users can explore different neighborhoods, discover points of interest (POIs), curate lists, and follow guided walks through the city.

## Tech Stack

- **Framework**: Astro (v5.16.4) - Hybrid SSR/Static site generator
- **Mapping**: Leaflet.js (v1.9.4) - Interactive map library
- **Geo Database**: Individual JSON files (file-based, API endpoints in dev)
- **Spatial Queries**: Turf.js (@turf/turf) - Client-side geospatial analysis
- **Styling**: Vanilla CSS with CSS Grid layout
- **Map Tiles**: CARTO Light (greyscale basemap)
- **Languages**: German (de) and English (en) with i18n support

## Architecture

### Hybrid Application

The application runs in two modes:

**Development Mode** (`npm run dev`):
- Server-side rendering with Node.js
- CMS available at `/cms` for managing POIs, walks, and lists
- API endpoints at `/api/*` for data management
- Hot reload during development

**Production Mode** (`npm run build:prod`):
- Static site generation for GitHub/Cloudflare Pages
- CMS and API routes excluded from build
- All data compiled to static JSON files
- No server runtime required

### Data Structure

Data is stored in individual JSON files for better version control and management:

**POI Files** (`public/data/pois/*.json`):
Each POI is a separate GeoJSON Feature file:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [16.3650, 48.1960]
  },
  "properties": {
    "id": "unique-poi-id",
    "name": "POI Name",
    "category": "restaurant",
    "description": {
      "de": "Beschreibung auf Deutsch",
      "en": "Description in English"
    },
    "link": "https://example.com",
    "instagram": "https://instagram.com/handle",
    "photo": "/uploads/image.jpg",
    "tags": ["outdoor", "vegan"]
  }
}
```

**Categories** (`public/data/categories.json`):
```json
{
  "categories": {
    "restaurant": {
      "name": { "de": "Restaurant", "en": "Restaurant" },
      "emoji": "🍽️",
      "color": "#FFFFFF",
      "icon": null
    }
  }
}
```

**Tags** (`public/data/tags.json`):
```json
{
  "tags": {
    "outdoor": { "name": "Outdoor" },
    "vegan": { "name": "Vegan" }
  }
}
```

**Walkthroughs** (`public/data/walkthroughs.json`):
```json
{
  "id": "walk-id",
  "slug": "walk-slug",
  "title": { "de": "Titel", "en": "Title" },
  "description": { "de": "Beschreibung", "en": "Description" },
  "pois": ["poi-id-1", "poi-id-2", "poi-id-3"]
}
```

**Lists** (`public/data/lists.json`):
```json
{
  "id": "list-id",
  "slug": "list-slug",
  "title": { "de": "Titel", "en": "Title" },
  "description": { "de": "Beschreibung", "en": "Description" },
  "pois": ["poi-id-1", "poi-id-2"]
}
```

**Grätzl Boundaries** (`public/data/graetzl_wien2025.json`):
GeoJSON FeatureCollection with Vienna neighborhood polygons.

**Important**: GeoJSON uses `[longitude, latitude]` order, while Leaflet uses `[latitude, longitude]`. The geoquery library handles conversions automatically.

### API Endpoints (Development Only)

- `GET /api/pois` - List all POIs
- `GET /api/pois/:id` - Get specific POI
- `POST /api/pois` - Create new POI
- `PUT /api/pois/:id` - Update POI
- `DELETE /api/pois/:id` - Delete POI
- `POST /api/upload` - Upload images
- `GET /api/walkthroughs` - List all walkthroughs
- `GET /api/lists` - List all lists
- `POST /api/categories` - Create category
- `POST /api/tags` - Create tag

### Content Management System

Access the CMS in development mode at `/cms`:

**Features**:
- Add, edit, and delete POIs
- Upload photos for POIs
- Manage categories and tags
- Create and manage walkthroughs (guided walks with numbered POIs)
- Create and manage lists (curated POI collections)
- Filter POIs by category
- Search POIs by name
- Auto-generate category/tag keys from names

**POI Form Fields**:
- Coordinates (lat/lng or Google Maps paste)
- Multilingual name and description (de/en)
- Category (autocomplete with existing)
- Tags (multiple selection)
- Link and Instagram URL
- Photo upload or URL

## Key Features

### Map Functionality
- **Initial View**: Vienna center (48.2082°N, 16.3738°E) at zoom level 12
- **Greyscale Styling**: CARTO Light basemap for clean, neutral appearance
- **Neighborhood Highlighting**: Semi-transparent red overlay with outline
- **Zoom Animation**: Smooth transition when selecting a Grätzl
- **Category Filtering**: Multi-select dropdown to filter POIs by category
- **POI Search**: Search POIs by name or description
- **Walkthroughs**: Guided walks with numbered markers and connecting arrows
- **Lists**: Curated POI collections with numbered markers

### Interactive Elements
- **Grätzl Selector**: Searchable dropdown with all Vienna neighborhoods
- **POI Search**: Quick search across all POIs
- **Category Filter**: Multi-select filter with search
- **Walkthrough Selector**: Choose from pre-defined walks
- **List Selector**: Browse curated POI lists
- **POI Markers**: Custom emoji/SVG icons with tooltips
- **Numbered Markers**: For walks and lists (clickable, with tooltips)
- **Popups**: Click markers to show detailed information with photos
- **Sidebar**: Shows walk/list details with clickable POI items
- **Language Switcher**: Toggle between German and English
- **Responsive Design**: Mobile-friendly with collapsible navigation

## Development Guidelines

### Adding POIs

**Via CMS (Recommended)**:
1. Run `npm run dev`
2. Navigate to `http://localhost:4321/cms`
3. Fill in the POI form
4. Upload a photo or provide a URL
5. Click "Create POI"

**Manual Method** (if needed):
Create a new file in `public/data/pois/` with a unique ID:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [16.3650, 48.1960]
  },
  "properties": {
    "id": "unique-id-here",
    "name": "POI Name",
    "category": "cafe",
    "description": {
      "de": "Beschreibung",
      "en": "Description"
    },
    "link": "https://example.com",
    "photo": "/uploads/photo.jpg",
    "tags": ["tag1", "tag2"]
  }
}
```

**Available Categories**:
- `restaurant` - 🍽️ Restaurant
- `cafe` - ☕ Café
- `breakfast` - 🥐 Frühstück
- `bar` - 🍺 Bar
- `gasthaus` - 🍺 Gasthaus
- `bookshop` - 📚 Buchhandlung
- `shop` - 🛍️ Geschäft
- `market` - 🛍️ Markt
- `cinema` - 🎬 Kino
- `theater` - 🎭 Theater
- `museum` - 🏛️ Museum
- `gallery` - 🎨 Galerie
- `park` - 🌳 Park
- `culture` - 🎪 Kultur

### Creating Walkthroughs

**Via CMS**:
1. Go to "Walkthrough Management" tab
2. Enter title and description in both languages
3. Search and add POIs in the desired order
4. Drag to reorder POIs
5. Click "Save Walkthrough"

Walkthroughs automatically generate:
- Numbered markers on POIs
- Directional arrows between stops
- Sidebar with walk details
- URL slug for sharing

### Creating Lists

**Via CMS**:
1. Go to "List Management" tab
2. Enter title and description in both languages
3. Search and add POIs
4. Drag to reorder
5. Click "Save List"

Lists show numbered POIs without connecting arrows.

### Coordinate Tips

**Finding Coordinates**:
1. Right-click location in Google Maps
2. Copy coordinates (format: "48.1960, 16.3650")
3. Paste into CMS "Google Maps Coordinates" field
4. CMS auto-converts to proper format

**Manual Format**:
- GeoJSON: `[longitude, latitude]` = `[16.3650, 48.1960]`
- Leaflet: `[latitude, longitude]` = `[48.1960, 16.3650]`
- Vienna: ~48.1-48.3°N (lat), 16.2-16.5°E (lng)

## Code Conventions

### Naming
- **POI IDs**: UUID format (e.g., `poi-abc123`)
- **CSS Classes**: kebab-case (e.g., `graetzl-btn`)
- **Variables**: camelCase (e.g., `currentPolygon`)
- **Slugs**: lowercase, hyphenated (e.g., `best-cafes-vienna`)

### Styling
- **Colors**:
  - Primary: `#667eea` (purple/blue) - Walkthroughs
  - Secondary: `#2563eb` (blue) - Lists
  - Highlight: `#FF6B6B` (red) - Grätzl overlay
  - Text: `#333` (dark gray)
  - Background: `#f5f5f5` (light gray)
- **Spacing**: Use rem units (1rem = 16px)
- **Borders**: 8px border-radius for modern look

### State Management
- `currentPolygon`: Active neighborhood overlay
- `currentMarkers`: Array of visible POI markers
- `currentWalkthrough`: Active walkthrough data
- `currentList`: Active list data
- `selectedCategories`: Set of active category filters
- `walkthroughArrows`: Arrows and number markers for walks
- `listMarkers`: Number markers for lists

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Quick Start

**GitHub Pages**:
```bash
npm run build:prod
# Push to GitHub, enable GitHub Pages with Actions
```

**Cloudflare Pages**:
```bash
npm run build:prod
# Deploy dist/ folder or connect GitHub repo
```

**Development (with CMS)**:
```bash
npm run dev
# CMS at http://localhost:4321/cms
```

## File Structure

```
/graetzlmap
├── src/
│   ├── lib/
│   │   ├── geoquery.js              # Geo query library
│   │   ├── slug-utils.js            # URL slug handling
│   │   └── i18n.js                  # Internationalization
│   ├── pages/
│   │   ├── index.astro              # Main map application
│   │   ├── cms.astro                # Content management system
│   │   └── api/                     # API endpoints (dev only)
│   │       ├── pois/
│   │       ├── walkthroughs/
│   │       ├── lists/
│   │       ├── categories/
│   │       ├── tags/
│   │       └── upload.ts
│   └── components/
├── public/
│   ├── data/
│   │   ├── pois/                    # Individual POI files
│   │   │   ├── poi-abc123.json
│   │   │   └── ...
│   │   ├── categories.json          # Category definitions
│   │   ├── tags.json                # Tag definitions
│   │   ├── walkthroughs.json        # Walkthrough data
│   │   ├── lists.json               # List data
│   │   └── graetzl_wien2025.json    # Vienna neighborhoods
│   └── uploads/                     # Uploaded photos
├── scripts/
│   └── cleanup-cms.js               # Remove CMS from prod build
├── .github/
│   └── workflows/
│       └── deploy.yml               # GitHub Pages deployment
├── package.json
├── astro.config.mjs
├── DEPLOYMENT.md                    # Deployment guide
└── agents.md                        # This file
```

## GeoQuery API Reference

The `geoquery.js` library provides spatial query capabilities using Turf.js.

### Loading Data

```javascript
import geoquery from '/src/lib/geoquery.js';

// Load POI data (via API in dev, static in prod)
const geoData = await geoquery.loadGeoData();
// Returns: FeatureCollection with all POI features

// Load Grätzl boundaries
const graetzlData = await geoquery.loadGraetzlData();
// Returns: FeatureCollection with neighborhood polygons
```

### Basic Queries

```javascript
// Get all Grätzl features
const graetzls = geoquery.getGraetzlFeatures(graetzlData);

// Get all POI features
const allPOIs = geoData.features;

// Get specific Grätzl by ID
const graetzl = geoquery.getGraetzl(graetzlData, 101);
```

### Filtering POIs

```javascript
// Get POIs by category
const restaurants = geoData.features.filter(
  poi => poi.properties.category === 'restaurant'
);

// Get POIs in a specific Grätzl (spatial query)
const poisInGraetzl = geoquery.getPOIsInGraetzl(geoData, graetzlData, 101);

// Combined filter: category + neighborhood
const filtered = geoquery.filterPOIsWithGraetzl(geoData, graetzlData, {
  graetzlId: 101,
  categories: ['restaurant', 'cafe']
});

// Get all categories
const categories = geoquery.getAllCategories(geoData);
```

### Spatial Queries

```javascript
// Find which Grätzl contains a point
const point = [16.3650, 48.1960]; // [lng, lat]
const graetzl = geoquery.findGraetzlAtPoint(graetzlData, point);

// Search POI names/descriptions
const results = geoquery.searchPOIs(geoData, 'coffee');
```

### Coordinate Conversion

```javascript
// GeoJSON to Leaflet (Point)
const leafletCoords = geoquery.featureToLeafletCoords(poiFeature);
// Returns: [48.1960, 16.3650] (lat, lng)

// Leaflet to GeoJSON
const geoCoords = geoquery.leafletCoordsToGeoJSON([48.1960, 16.3650]);
// Returns: [16.3650, 48.1960] (lng, lat)
```

## i18n API Reference

The `i18n.js` library handles multilingual content:

```javascript
import { getCurrentLanguage, setLanguage, t } from '/src/lib/i18n.js';

// Get current language
const lang = getCurrentLanguage(); // 'de' or 'en'

// Change language
setLanguage('en');

// Translate key
const text = t('header.subtitle');

// Listen for language changes
window.addEventListener('languagechange', () => {
  // Update UI
});
```

## Common Tasks

### Add New Category

Via CMS or edit `public/data/categories.json`:
```json
"newcategory": {
  "name": { "de": "Name DE", "en": "Name EN" },
  "emoji": "🎯",
  "color": "#FFFFFF",
  "icon": null
}
```

### Change Map Style

Edit `src/lib/map-init.js`:
```javascript
// CARTO Dark
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {...})

// OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {...})
```

### Customize Colors

Edit variables in `src/lib/map-init.js`:
- Walkthrough color: `#667eea` (purple)
- List color: `#2563eb` (blue)
- Grätzl overlay: `#FF6B6B` (red)

### Add Translation Keys

Edit `src/lib/i18n.js` to add new translation strings.

## Development Commands

```bash
npm install           # Install dependencies
npm run dev           # Dev server with CMS (http://localhost:4321)
npm run build         # Build with CMS (for Node.js hosting)
npm run build:prod    # Build without CMS (for static hosting)
npm run preview       # Preview production build
```

## Performance Notes

- **POI Loading**: Individual files loaded once, cached in memory
- **Query Speed**: All spatial queries <1ms on modern browsers
- **Production Build**: Fully static, no server required
- **Image Optimization**: Photos stored in `/public/uploads/`

## Troubleshooting

### CMS Not Working
- Ensure running in dev mode: `npm run dev`
- CMS requires Node.js server (not available in static build)
- Check that API endpoints are accessible

### POIs Not Appearing
- Verify coordinates are valid GeoJSON format `[lng, lat]`
- Check POI files are valid JSON
- Ensure category exists in `categories.json`

### Map Not Displaying
- Check Leaflet CSS is loaded
- Verify `#map` container has explicit height
- Check browser console for errors

## Resources

- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [Turf.js Documentation](https://turfjs.org/docs/)
- [Astro Documentation](https://docs.astro.build)
- [GeoJSON Specification](https://geojson.org/)
- [GeoJSON.io](http://geojson.io) - Draw and edit GeoJSON

## Contact & Contributions

When adding POIs, consider:
1. Accuracy of location and information
2. Quality photos (upload via CMS)
3. Multilingual descriptions (de/en)
4. Appropriate categorization and tags
5. Relevance to Vienna's Grätzl culture

Keep the map welcoming to both locals and tourists!
