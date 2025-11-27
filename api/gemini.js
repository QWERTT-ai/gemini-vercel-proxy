/**
 * Gemini API 中转服务 - Vercel Serverless Function
 */

export default async function handler(req, res) {
  // 允许 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 从环境变量获取 Gemini API Key
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'Server configuration error: GEMINI_API_KEY not set'
    });
  }

  try {
    // 获取请求体
    const { model, messages, stream, temperature, max_tokens } = req.body;

    // 验证必需参数
    if (!model || !messages) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['model', 'messages']
      });
    }

    // 转换消息格式：OpenAI -> Gemini
    const contents = messages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      return {
        role: role,
        parts: [{ text: msg.content }]
      };
    });

    // 构建 Gemini API 请求
    const streamParam = stream ? 'streamGenerateContent' : 'generateContent';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${streamParam}?key=${GEMINI_API_KEY}`;

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: max_tokens ?? 2048
      }
    };

    // 调用 Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API Error:', errorText);
      return res.status(geminiResponse.status).json({
        error: 'Gemini API request failed',
        status: geminiResponse.status,
        details: errorText
      });
    }

    // 处理非流式响应
    if (!stream) {
      const data = await geminiResponse.json();

      // 转换为 OpenAI 格式
      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0
        }
      };

      return res.status(200).json(response);
    }

    // 处理流式响应
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = geminiResponse.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            if (text) {
              const streamResponse = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                  index: 0,
                  delta: { content: text },
                  finish_reason: null
                }]
              };
              res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamError) {
      console.error('Stream error:', streamError);
      res.end();
    }

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
