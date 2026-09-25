import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncAll } from '../lib/sync.js';
export default async function handler(req:VercelRequest,res:VercelResponse) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'POST erforderlich'});
  // Public trigger can only import the four fixed public sources. The DB lease bounds load.
  try { const result=await syncAll(); return res.status(result.ok?200:502).json(result); }
  catch(error) {console.error(error);return res.status(503).json({ok:false,error:'Archivierung derzeit nicht erreichbar'});}
}
