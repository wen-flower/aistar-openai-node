const {Configuration, OpenAIApi} = require("../dist")

const configuration = new Configuration({
    apiKey: "2795f509-3698-43a9-9c71-503cc03b5c2d",
});
// const configuration = new Configuration({
//     apiKey: "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",
// });
const openai = new OpenAIApi(configuration);

openai.createChatCompletionSSE({
    model: "gpt-3.5-turbo",
    messages: [{role: "user", content: "Hello World!"}],
    stream: true
}).then(res => {
    res.message = (resp) => {
        console.log("resp = ", resp)
    }
})