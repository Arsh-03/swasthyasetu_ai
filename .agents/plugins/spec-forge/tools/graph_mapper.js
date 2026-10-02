/**
 * Recursive Graphify / Relationship Mapper for Antigravity Forge
 * Recursively scans all subdirectories in docs/ (00_overview, 01_architecture, etc.),
 * extracts entities, endpoints, screens, and dependencies into .forge/graph.json
 * and generates an interactive visual force-directed graph in .forge/graph.html.
 */

import fs from 'node:fs';
import path from 'node:path';

function getMarkdownFilesRecursive(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getMarkdownFilesRecursive(filePath));
    } else if (file.endsWith('.md')) {
      results.push(filePath);
    }
  }
  return results;
}

export function generateKnowledgeGraph(projectRoot) {
  const docsDir = path.join(projectRoot, 'docs');
  const forgeDir = path.join(projectRoot, '.forge');

  if (!fs.existsSync(forgeDir)) {
    fs.mkdirSync(forgeDir, { recursive: true });
  }

  const nodes = [];
  const links = [];
  const nodeSet = new Set();

  function addNode(id, label, type, details = '') {
    if (!nodeSet.has(id)) {
      nodeSet.add(id);
      nodes.push({ id, label, type, details });
    }
  }

  function addLink(source, target, relation) {
    links.push({ source, target, relation });
  }

  // Scan documentation files recursively
  const mdFiles = getMarkdownFilesRecursive(docsDir);

  for (const filePath of mdFiles) {
    const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const docId = `doc:${relPath}`;

    addNode(docId, fileName, 'document', `Specification doc: ${relPath}`);

    // Link doc to its category folder
    const categoryDir = path.basename(path.dirname(filePath));
    const catId = `cat:${categoryDir}`;
    addNode(catId, categoryDir, 'system', `Category Module: ${categoryDir}`);
    addLink(catId, docId, 'contains');

    // Extract entities
    const entityMatches = content.matchAll(/### Entity:\s*([^\n]+)|###\s*([A-Z][a-zA-Z0-9]+)\s*Model|CREATE TABLE\s+([a-zA-Z0-9_]+)/g);
    for (const m of entityMatches) {
      const entityName = (m[1] || m[2] || m[3]).trim();
      const entityId = `entity:${entityName}`;
      addNode(entityId, entityName, 'entity', `Data Model / Entity`);
      addLink(docId, entityId, 'defines');
    }

    // Extract API endpoints
    const apiMatches = content.matchAll(/(GET|POST|PUT|DELETE|PATCH)\s+(`?\/[a-zA-Z0-9_\-\/{}]*`?)/g);
    for (const m of apiMatches) {
      const method = m[1];
      const endpoint = m[2].replace(/`/g, '');
      const apiId = `api:${method} ${endpoint}`;
      addNode(apiId, `${method} ${endpoint}`, 'api', `API Endpoint`);
      addLink(docId, apiId, 'specifies');
    }

    // Extract UI screens
    const uiMatches = content.matchAll(/### Screen:\s*([^\n]+)|##\s*([a-zA-Z0-9\s]+View|[a-zA-Z0-9\s]+Dashboard|[a-zA-Z0-9\s]+Portal)/g);
    for (const m of uiMatches) {
      const screenName = (m[1] || m[2]).trim();
      const screenId = `ui:${screenName}`;
      addNode(screenId, screenName, 'ui', `User Interface View`);
      addLink(docId, screenId, 'renders');
    }
  }

  if (nodes.length === 0) {
    addNode('system:core', 'System Core', 'system', 'Root architecture node');
    addNode('doc:init', 'Pending Specs', 'document', 'Run /forge to populate');
    addLink('system:core', 'doc:init', 'monitors');
  }

  const graphData = {
    updatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    linkCount: links.length,
    nodes,
    links,
  };

  // 1. Write graph.json
  fs.writeFileSync(path.join(forgeDir, 'graph.json'), JSON.stringify(graphData, null, 2), 'utf-8');

  // 2. Generate interactive visual graph.html
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CareBridge / Antigravity Knowledge Graph</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; overflow: hidden; }
    #header { position: absolute; top: 16px; left: 20px; z-index: 10; }
    h1 { margin: 0; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 0.75rem; background: #1e293b; padding: 4px 8px; border-radius: 9999px; border: 1px solid #334155; }
    #canvas { width: 100vw; height: 100vh; display: block; }
    .legend { position: absolute; bottom: 20px; left: 20px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; font-size: 0.8rem; display: flex; gap: 16px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot-doc { background: #38bdf8; }
    .dot-entity { background: #4ade80; }
    .dot-api { background: #f43f5e; }
    .dot-ui { background: #fbbf24; }
    .dot-sys { background: #a855f7; }
  </style>
</head>
<body>
  <div id="header">
    <h1>⚡ Spec-Forge Topology Graph <span class="badge">${nodes.length} nodes · ${links.length} relationships</span></h1>
  </div>
  <canvas id="canvas"></canvas>
  <div class="legend">
    <div class="legend-item"><span class="dot dot-sys"></span> Modules</div>
    <div class="legend-item"><span class="dot dot-doc"></span> Documents</div>
    <div class="legend-item"><span class="dot dot-entity"></span> Entities / Models</div>
    <div class="legend-item"><span class="dot dot-api"></span> API Endpoints</div>
    <div class="legend-item"><span class="dot dot-ui"></span> UI Views</div>
  </div>
  <script>
    const data = ${JSON.stringify(graphData)};
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const colors = {
      document: '#38bdf8',
      entity: '#4ade80',
      api: '#f43f5e',
      ui: '#fbbf24',
      system: '#a855f7'
    };

    const nodes = data.nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 400,
      y: height / 2 + (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0
    }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    function step() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 180) {
            const force = (180 - dist) / dist * 0.05;
            nodes[i].vx -= dx * force;
            nodes[i].vy -= dy * force;
            nodes[j].vx += dx * force;
            nodes[j].vy += dy * force;
          }
        }
      }

      for (const link of data.links) {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (s && t) {
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 100) * 0.005;
          s.vx += dx * force;
          s.vy += dy * force;
          t.vx -= dx * force;
          t.vy -= dy * force;
        }
      }

      for (const n of nodes) {
        n.vx += (width / 2 - n.x) * 0.0008;
        n.vy += (height / 2 - n.y) * 0.0008;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
      }

      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      for (const link of data.links) {
        const s = nodeMap.get(link.source);
        const t = nodeMap.get(link.target);
        if (s && t) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      for (const n of nodes) {
        ctx.fillStyle = colors[n.type] || '#94a3b8';
        ctx.beginPath();
        const radius = n.type === 'system' ? 10 : (n.type === 'document' ? 7 : 5);
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = n.type === 'system' ? 'bold 12px sans-serif' : '10px sans-serif';
        ctx.fillText(n.label, n.x + 9, n.y + 3);
      }

      requestAnimationFrame(step);
    }

    step();
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(forgeDir, 'graph.html'), htmlContent, 'utf-8');
  return graphData;
}

if (process.argv[1] && process.argv[1].endsWith('graph_mapper.js')) {
  generateKnowledgeGraph(process.cwd());
  console.log('Graph topology generated in .forge/');
}
