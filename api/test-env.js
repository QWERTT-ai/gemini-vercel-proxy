/**
 * 临时测试端点 - 检查环境变量
 */

export default function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  res.status(200).json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('GEMINI'))
  });
}
