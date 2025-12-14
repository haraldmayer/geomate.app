import fs from 'fs';
import path from 'path';

const LISTS_FILE = path.join(process.cwd(), 'public', 'data', 'lists.json');

// POST /api/lists/reorder - Update list order
export async function POST({ request }) {
  try {
    const { lists: orderedLists } = await request.json();

    if (!orderedLists || !Array.isArray(orderedLists)) {
      return new Response(JSON.stringify({ error: 'Invalid data format' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Read current lists
    const content = fs.readFileSync(LISTS_FILE, 'utf8');
    const data = JSON.parse(content);

    // Update order for each list
    orderedLists.forEach(({ id, order }) => {
      const listIndex = data.lists.findIndex(l => l.id === id);
      if (listIndex !== -1) {
        data.lists[listIndex].order = order;
      }
    });

    // Save back to file
    fs.writeFileSync(LISTS_FILE, JSON.stringify(data, null, 2));

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
