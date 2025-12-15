import fs from 'fs';
import path from 'path';
import { compilePOIs } from '../../../lib/compile-pois.js';

const POIS_DIR = path.join(process.cwd(), 'public', 'data', 'pois');

// GET /api/pois/[id] - Get single POI
export async function GET({ params }) {
  try {
    const { id } = params;
    const filepath = path.join(POIS_DIR, `${id}.json`);

    if (!fs.existsSync(filepath)) {
      return new Response(JSON.stringify({ error: 'POI not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const poi = JSON.parse(content);

    return new Response(JSON.stringify(poi), {
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

// PUT /api/pois/[id] - Update POI
export async function PUT({ params, request }) {
  try {
    const { id } = params;
    const filepath = path.join(POIS_DIR, `${id}.json`);

    if (!fs.existsSync(filepath)) {
      return new Response(JSON.stringify({ error: 'POI not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const poi = await request.json();

    // Ensure ID is preserved
    poi.properties = poi.properties || {};
    poi.properties.id = id;

    fs.writeFileSync(filepath, JSON.stringify(poi, null, 2));

    // Recompile all-pois.json
    compilePOIs();

    return new Response(JSON.stringify({ success: true, poi }), {
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

// DELETE /api/pois/[id] - Delete POI
export async function DELETE({ params }) {
  try {
    const { id } = params;
    const filepath = path.join(POIS_DIR, `${id}.json`);

    if (!fs.existsSync(filepath)) {
      return new Response(JSON.stringify({ error: 'POI not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    fs.unlinkSync(filepath);

    // Recompile all-pois.json
    compilePOIs();

    return new Response(JSON.stringify({ success: true }), {
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
