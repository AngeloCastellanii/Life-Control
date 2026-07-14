import { createPublicEnvProvider } from './utils/publicEnvResolver.js';

const provider = createPublicEnvProvider({
  mode: 'production',
  envFilePath: null
});

export default function handler(req, res) {
  const payload = provider.getPayload();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(payload);
}
