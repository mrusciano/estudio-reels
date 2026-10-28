// Utilidades compartidas por las herramientas: API key de ElevenLabs y perfil del estudio.
import fs from 'node:fs';
// La key sale de la variable de entorno ELEVENLABS_API_KEY o del archivo .env (que NUNCA se sube a git).
export function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const m = fs.existsSync('.env') && fs.readFileSync('.env', 'utf8').match(/ELEVENLABS_API_KEY=(\S+)/);
  if (!m) { console.error('Falta ELEVENLABS_API_KEY: copiá .env.example a .env y pegá tu key (elevenlabs.io → Profile → API keys).'); process.exit(1); }
  return m[1];
}
// perfil/estudio.json (lo escribe /configurar). Devuelve {} si todavía no existe.
export function perfil() {
  try { return JSON.parse(fs.readFileSync('perfil/estudio.json', 'utf8')); } catch { return {}; }
}
