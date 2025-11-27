/**
 * Gemini API 中转服务 - Vercel Serverless Function
 *
 * 功能：为国内前端提供 Gemini API 访问能力
 * - 隐藏 API Key，保证安全
 * - 海外节点调用，解决国内访问问题
 * - 支持流式和非流式响应
 */

export default async function handler(req, res) {
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
    const { model, messages, stream, temperature, max_tokens, ...otherParams } = req.body;

    // 验证必需参数
    if (!model || !messages) {
      return res.status(400).json({
        error: 'Missing required parameters: model and messages are required'
      });
    }

    // 构建 Gemini API 请求 URL
    const geminiModel = model.replace('gemini-', ''); // 处理模型名称
    const streamParam = stream ? 'streamGenerateContent' : 'generateContent';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${streamParam}?key=${GEMINI_API_KEY}`;

    // 转换 OpenAI 格式消息为 Gemini 格式
    const geminiMessages = convertMessagesToGemini(messages);

    // 构建 Gemini 请求体
    const geminiRequestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: max_tokens || 2048,
        ...otherParams
      }
    };

    // 调用 Gemini API
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error('Gemini API Error:', errorData);
      return res.status(geminiResponse.status).json({
        error: 'Gemini API request failed',
        details: errorData
      });
    }

    // 处理流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = geminiResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              // 转换为 OpenAI 兼容格式
              const openaiFormat = convertGeminiToOpenAI(data, model);
              res.write(`data: ${JSON.stringify(openaiFormat)}\n\n`);
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 处理非流式响应
      const data = await geminiResponse.json();

      // 转换为 OpenAI 兼容格式
      const openaiFormat = {
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

      res.status(200).json(openaiFormat);
    }

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * 转换 OpenAI 格式消息为 Gemini 格式
 */
function convertMessagesToGemini(messages) {
  return messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
}

/**
 * 转换 Gemini 响应为 OpenAI 兼容格式
 */
function convertGeminiToOpenAI(geminiData, model) {
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: {
        content: geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      },
      finish_reason: geminiData.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : null
    }]
  };
}
