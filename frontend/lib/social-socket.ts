import { io, type Socket } from "socket.io-client";

import { getToken, socialApiBase } from "@/lib/social-api";

let socketRef: Socket | null = null;

function resolveSocketBase() {
  return socialApiBase.replace(/\/$/, "");
}

export function getSocialSocket(): Socket {
  if (socketRef) return socketRef;
  socketRef = io(resolveSocketBase(), {
    path: "/ws/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    auth: { token: getToken() },
  });
  return socketRef;
}

export function refreshSocketAuth() {
  const socket = getSocialSocket();
  socket.auth = { token: getToken() };
  if (socket.connected) socket.disconnect();
  socket.connect();
}
