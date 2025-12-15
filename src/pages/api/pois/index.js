import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compilePOIs } from '../../../lib/compile-pois.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POIS_DIR = path.join(process.cwd(), 'public', 'data', 'pois');

// Ensure POIs directory exists
if (!fs.existsSync(POIS_DIR)) {
  fs.mkdirSync(POIS_DIR, { recursive: true });
}

// GET /api/pois - List all POIs
export async function GET() {
  try {
    const files = fs.readdirSync(POIS_DIR).filter(f => f.endsWith('.json'));
    const pois = files.map(file => {
      const content = fs.readFileSync(path.join(POIS_DIR, file), 'utf8');
      return JSON.parse(content);
    });

    return new Response(JSON.stringify(pois), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// POST /api/pois - Create new POI
export async function POST({ request }) {
  try {
    const poi = await request.json();

    // Generate unique ID based on timestamp and random string
    const id = `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add ID to POI
    poi.properties = poi.properties || {};
    poi.properties.id = id;

    // Save to file
    const filepath = path.join(POIS_DIR, `${id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(poi, null, 2));

    // Recompile all-pois.json
    compilePOIs();

    return new Response(JSON.stringify({ success: true, id, poi }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
