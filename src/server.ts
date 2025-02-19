// src/server.ts (Standalone Server - Example)
import { Server, Socket } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow any origin.  Adjust for production.
    methods: ["GET", "POST"],
  },
});

// Simple storage for text changes.  Use a more robust solution for a real-world application.
const sessionTextChanges: { [sessionCode: string]: { [uri: string]: string } } =
  {}; // { sessionCode: { uri: content } }

io.on("connection", (socket: Socket) => {
  console.log("a user connected");
  const sessionCode = socket.handshake.query.sessionCode as string | undefined;

  if (sessionCode) {
    socket.join(sessionCode); // Join the room for the session
    console.log(`User connected to session: ${sessionCode}`);

    socket.on("joinSession", (sessionCode: string) => {
      socket.join(sessionCode);
      console.log(`User joined session: ${sessionCode}`);
    });

    socket.on("textChange", (data: any) => {
      if (!data.sessionCode) {
        console.warn("Received textChange without sessionCode");
        return;
      }
      console.log(
        `textChange from ${socket.id} in session ${data.sessionCode}`
      );

      // Broadcast the change to all clients in the same session *except* the sender
      socket.to(data.sessionCode).emit("textChange", data); //  use socket.to(sessionCode).emit to send to all clients in the room

      // Store the changes (example - consider a proper database)
      if (!sessionTextChanges[data.sessionCode]) {
        sessionTextChanges[data.sessionCode] = {};
      }
      sessionTextChanges[data.sessionCode][data.uri] = data.newText;
    });
  } else {
    console.warn("User connected without a session code.");
    socket.disconnect(true); // Disconnect if no session code is provided (optional, but good security)
  }

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`Socket.IO server listening on port ${port}`);
});
