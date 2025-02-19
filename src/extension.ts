// src/extension.ts
import * as vscode from "vscode";
import * as io from "socket.io-client"; // Import the client-side socket.io
import { Server, Socket } from "socket.io"; // for potential embedded server (if you want a self-contained solution).

// Configuration (Consider using vscode.workspace.getConfiguration for more persistent settings)
const SERVER_URL = "http://localhost:3000"; // Default server URL (Can be made configurable)
let socket: any; // Socket.io client instance
let sessionCode: string | null = null; // The session code

function connectToSocket(url: string, sessionCode: string | null = null): void {
  socket = io.connect(url, {
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
    query: {
      // Pass session code to the server
      sessionCode: sessionCode,
    },
  });

  socket!.on("connect", () => {
    vscode.window.showInformationMessage(
      "Connected to collaborative session server."
    );

    // Optional: Send a message to the server upon connecting.  Use sessionCode to differentiate sessions.
    if (sessionCode) {
      socket?.emit("joinSession", sessionCode);
      vscode.window.showInformationMessage(`Joined session ${sessionCode}`);
    }
  });

  socket!.on("disconnect", (reason: string) => {
    vscode.window.showErrorMessage(
      `Disconnected from collaborative session server: ${reason}`
    );
    socket = null; // Reset socket
  });

  // Handle text changes
  socket!.on("textChange", (data: any) => {
    if (
      !vscode.window.activeTextEditor ||
      vscode.window.activeTextEditor.document.uri.toString() !== data.uri
    ) {
      return; // Ignore changes for other files
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
      editor.document.positionAt(data.start),
      editor.document.positionAt(data.end)
    );
    edit.replace(editor.document.uri, range, data.newText);

    vscode.workspace.applyEdit(edit);
  });
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Collaborative Coding extension is now active!");

  // Command: Start Session
  let startSessionDisposable = vscode.commands.registerCommand(
    "collaborativeCoding.startSession",
    async () => {
      const generateSessionCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate a simple session code.
      };

      sessionCode = generateSessionCode();

      // Potentially start an embedded server here (or point the user to start a separate server). For this example, we assume an external server.

      vscode.window.showInformationMessage(
        `Session started. Session Code: ${sessionCode}`
      );
      connectToSocket(SERVER_URL, sessionCode); // connect with session code
    }
  );

  // Command: Join Session
  let joinSessionDisposable = vscode.commands.registerCommand(
    "collaborativeCoding.joinSession",
    async () => {
      const sessionCodeInput = await vscode.window.showInputBox({
        prompt: "Enter Session Code:",
        placeHolder: "e.g., ABC123",
        ignoreFocusOut: true, // Keep the input box open until a response is given.
      });

      if (!sessionCodeInput) {
        return; // User cancelled
      }

      sessionCode = sessionCodeInput.toUpperCase(); // standardize the input

      connectToSocket(SERVER_URL, sessionCode); // Connect to existing session
    }
  );

  // Event: Text changes (send to server)
  vscode.workspace.onDidChangeTextDocument((event) => {
    if (
      socket &&
      socket.connected &&
      sessionCode &&
      event.document === vscode.window.activeTextEditor?.document
    ) {
      event.contentChanges.forEach((change) => {
        const start = event.document.offsetAt(change.range.start);
        const end = event.document.offsetAt(change.range.end);
        socket?.emit("textChange", {
          sessionCode: sessionCode, // Necessary if the server manages multiple sessions
          uri: event.document.uri.toString(),
          start,
          end,
          newText: change.text,
        });
      });
    }
  });

  context.subscriptions.push(startSessionDisposable, joinSessionDisposable);
}

export function deactivate() {
  if (socket) {
    socket.disconnect();
  }
  console.log("Collaborative Coding extension is now deactive!");
}
