import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncAll } from '../lib/sync.js';
// Compatibility for the existing scheduler during the production transition.
export default async function handler(req:VercelRequest,res:VercelResponse) {
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method||''))return res.status(405).json({ok:false});
 try {const result=await syncAll();return res.status(result.ok?200:502).json(result);}
 catch(error){console.error(error);return res.status(503).json({ok:false,error:'Archivierung derzeit nicht erreichbar'});}
}
