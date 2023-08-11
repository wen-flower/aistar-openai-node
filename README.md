# AiStar Node.js Library

AiStar Node.js 库提供从 Node.js 应用程序方便地访问 AiStar API。

> ⚠️ **重要提示：该库仅供服务器端使用**

## 安装

```bash
npm install aistar-node
```

## 用法

```javascript
const { Configuration, OpenAIApi } = require("aistar-node");

const configuration = new Configuration({
  apiKey: process.env.AISTAR_API_KEY,
});
const openai = new OpenAIApi(configuration);

openai.createChatCompletionSSE({
  model: "gpt-3.5-turbo",
  messages: [{role: "user", content: "Hello world"}],
}).then(res => {
    res.message = (resp) => {
        console.log("resp = ", resp)
    }
});
```

## 支持

> ⚠️ **该库仅支持：createChatCompletionSSE 方法**

## Todo

> Other Method