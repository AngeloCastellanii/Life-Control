export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    status: 'ok',
    mode: 'production',
    platform: 'vercel',
    folder: 'dist',
    timestamp: new Date().toISOString(),
    framework: 'Slice.js',
    version: '2.0.0'
  });
}
