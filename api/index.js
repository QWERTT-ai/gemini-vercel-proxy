/**
 * 首页 - 显示 API 使用说明
 */

export default function handler(req, res) {
  res.status(200).json({
    name: 'Gemini Vercel Proxy',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      gemini: {
        path: '/api/gemini',
        method: 'POST',
        description: 'Gemini API 中转服务'
      }
    },
    usage: {
      example: {
        url: 'https://gemini-vercel-proxy-3vrb.vercel.app/api/gemini',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          model: 'gemini-2.0-flash-exp',
          messages: [
            { role: 'user', content: '你好' }
          ]
        }
      }
    },
    documentation: 'https://github.com/QWERTT-ai/gemini-vercel-proxy'
  });
}
