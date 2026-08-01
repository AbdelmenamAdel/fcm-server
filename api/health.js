module.exports = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use GET.' });
  }

  return res.status(200).json({
    success: true,
    status: 'ok',
    service: 'fcm-server',
    timestamp: new Date().toISOString(),
  });
};
