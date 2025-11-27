# Gemini Vercel 中转服务

为国内用户提供 Google Gemini API 访问能力的轻量级中转服务。

## 功能特点

- ✅ **国内可访问**: 部署在 Vercel 海外节点,国内用户可直接访问
- ✅ **安全**: API Key 存储在 Vercel 环境变量,不会暴露给前端
- ✅ **免费**: Vercel 免费额度足够个人/小团队使用
- ✅ **简单**: 无需服务器、数据库,一键部署
- ✅ **兼容**: 支持 OpenAI 格式调用,方便前端集成
- ✅ **流式支持**: 支持流式和非流式响应

## 快速开始

### 1. 获取 Gemini API Key

访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 创建 API Key

### 2. 部署到 Vercel

#### 方法 A: 一键部署 (推荐)

点击下方按钮一键部署:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/gemini-vercel-proxy&env=GEMINI_API_KEY)

部署时需要配置环境变量:
- `GEMINI_API_KEY`: 你的 Gemini API Key

#### 方法 B: 手动部署

```bash
# 1. Clone 项目
git clone https://github.com/YOUR_USERNAME/gemini-vercel-proxy.git
cd gemini-vercel-proxy

# 2. 安装 Vercel CLI
npm install -g vercel

# 3. 登录 Vercel
vercel login

# 4. 部署
vercel

# 按照提示操作:
# - Set up and deploy? Y
# - Which scope? 选择你的账号
# - Link to existing project? N
# - Project name? 回车使用默认
# - In which directory is your code located? ./
# - Want to override settings? N

# 5. 配置环境变量
vercel env add GEMINI_API_KEY
# 输入你的 Gemini API Key

# 6. 生产环境部署
vercel --prod
```

部署成功后,你会得到一个地址,例如: `https://your-project.vercel.app`

### 3. 前端调用示例

#### JavaScript/TypeScript

```javascript
// 基础调用
async function callGemini() {
  const response = await fetch('https://your-project.vercel.app/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [
        { role: 'user', content: '你好,请介绍一下自己' }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  const data = await response.json();
  console.log(data.choices[0].message.content);
}

// 流式调用
async function callGeminiStream() {
  const response = await fetch('https://your-project.vercel.app/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-exp',
      messages: [
        { role: 'user', content: '写一首关于春天的诗' }
      ],
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        const json = JSON.parse(data);
        const content = json.choices[0].delta.content;
        if (content) {
          console.log(content);
        }
      }
    }
  }
}
```

#### React 示例

```jsx
import { useState } from 'react';

function GeminiChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://your-project.vercel.app/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.0-flash-exp',
          messages: [...messages, userMessage],
          stream: false
        })
      });

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0].message.content
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && sendMessage()}
        disabled={loading}
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? '发送中...' : '发送'}
      </button>
    </div>
  );
}
```

## API 文档

### 请求格式

**端点**: `POST /api/gemini`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 2048
}
```

**参数说明**:
- `model` (必需): Gemini 模型名称,支持的模型:
  - `gemini-2.0-flash-exp` (推荐,最新)
  - `gemini-1.5-pro`
  - `gemini-1.5-flash`
  - `gemini-1.5-flash-8b`
- `messages` (必需): 对话消息数组
  - `role`: `user` 或 `assistant`
  - `content`: 消息内容
- `stream` (可选): 是否流式返回,默认 `false`
- `temperature` (可选): 生成随机性,0-1,默认 `0.7`
- `max_tokens` (可选): 最大生成 token 数,默认 `2048`

### 响应格式

**非流式响应**:
```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gemini-2.0-flash-exp",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "你好!我是 Gemini..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  }
}
```

**流式响应**:
```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"你"}}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

## 环境变量配置

在 Vercel 后台配置以下环境变量:

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GEMINI_API_KEY` | Gemini API Key | `AIzaSy...` |

配置方式:
1. 访问 Vercel 项目设置
2. 进入 `Settings` → `Environment Variables`
3. 添加 `GEMINI_API_KEY` 变量
4. 重新部署项目使配置生效

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建 .env 文件
cp .env.example .env
# 编辑 .env,填入你的 GEMINI_API_KEY

# 3. 启动本地开发服务器
npm run dev

# 4. 测试
# 访问 http://localhost:3000/api/gemini
```

测试请求:
```bash
curl -X POST http://localhost:3000/api/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 常见问题

### 1. 国内访问 Vercel 慢怎么办?

Vercel 在国内访问速度一般可以接受。如果遇到问题:
- 使用 Cloudflare 反向代理加速
- 或者部署到 Railway、Render 等其他平台

### 2. 免费额度够用吗?

Vercel 免费额度:
- 每月 100GB 带宽
- 100GB-hours 函数执行时间
- 100,000 次函数调用

对于个人/小团队完全够用。

### 3. 支持哪些 Gemini 模型?

支持所有 Gemini API 提供的模型:
- Gemini 2.0 Flash (最新,推荐)
- Gemini 1.5 Pro (强大,较慢)
- Gemini 1.5 Flash (快速,推荐)
- Gemini 1.5 Flash-8B (超快,轻量)

### 4. 如何查看请求日志?

访问 Vercel 后台:
- 项目 → Functions → 选择函数 → Logs

### 5. 如何更新代码?

```bash
git pull origin main
vercel --prod
```

## 项目结构

```
gemini-vercel-proxy/
├── api/
│   └── gemini.js          # 核心 API 处理函数
├── .env.example           # 环境变量示例
├── .gitignore            # Git 忽略文件
├── package.json          # 项目配置
├── vercel.json           # Vercel 部署配置
└── README.md             # 说明文档
```

## 许可证

MIT License

## 支持

如有问题,请提交 Issue 或 PR。
