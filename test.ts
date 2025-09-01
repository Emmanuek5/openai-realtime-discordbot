import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
  headers: {
    Authorization: "Bearer " + process.env.OPENAI_API_KEY,
  },
});

ws.on("open", function open() {
  console.log("Connected to server.");

  // Send client events over the WebSocket once connected
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: "Be extra nice today!",
      },
    })
  );
});

// Listen for and parse server events
ws.on("message", function incoming(message) {
  console.log(JSON.parse(message.toString()));
});
