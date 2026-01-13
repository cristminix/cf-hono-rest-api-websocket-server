import { Hono } from "hono"
import { upgradeWebSocket } from "hono/cloudflare-workers"

interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
}

const app = new Hono<{ Bindings: Env }>()

// Simple WebSocket route without global connection management
app.get(
  "/websocket",
  upgradeWebSocket((c) => {
    // Generate unique connection ID
    const connectionId = `ws-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`
    let isAlive = true

    return {
      onUpgrade: (ws: any) => {
        // Send welcome message
        ws.send(
          JSON.stringify({
            type: "welcome",
            connectionId,
            timestamp: new Date().toISOString(),
          })
        )
      },

      onMessage: (evt, ws) => {
        try {
          isAlive = true

          let messageData: any
          let messageType = "text"

          // Validate and parse the incoming message
          try {
            messageData = JSON.parse(evt.data.toString())
            messageType = messageData.type || "message"
          } catch (parseError) {
            // If not JSON, treat as plain text
            messageData = { content: evt.data.toString() }
            messageType = "text"
          }

          console.log(
            `Received ${messageType} from ${connectionId}:`,
            messageData
          )

          // Simple message echo for testing
          if (messageType === "ping") {
            ws.send(
              JSON.stringify({
                type: "pong",
                timestamp: Date.now(),
              })
            )
          } else {
            // Echo the message back to the sender
            ws.send(
              JSON.stringify({
                type: "echo",
                content: messageData.content || evt.data.toString(),
                connectionId,
                timestamp: new Date().toISOString(),
              })
            )
          }
        } catch (error) {
          console.error(`Error processing message from ${connectionId}:`, error)
          try {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message format",
              })
            )
          } catch (sendError) {
            console.error("Failed to send error response:", sendError)
          }
        }
      },

      onClose: (evt, ws) => {
        console.log(
          `WebSocket connection closed for ${connectionId}: Code ${
            evt.code
          }, Reason: ${evt.reason?.toString()}`
        )
        isAlive = false
      },

      onError: (evt, ws) => {
        console.error(`WebSocket error for ${connectionId}:`, evt)
        isAlive = false
      },
    }
  })
)

// Simple GET route
app.get("/", (c) => {
  return c.text(`Hello Hono with WebSockets!
WebSocket endpoint: /websocket`)
})

// Simple health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})

export default app
