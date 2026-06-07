"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://localhost:5001";

export default function Home() {
  const [browserState, setBrowserState] = useState<"offline" | "provisioning" | "online">("offline");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [rtt, setRtt] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const frameCountRef = useRef<number>(0);
  const fpsIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup sockets and intervals when component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);

  const handleProvision = async () => {
    setBrowserState("provisioning");
    setErrorMsg(null);
    setImageSrc(null);
    setFps(0);
    setRtt(0);

    try {
      // 1. Request container startup
      const res = await fetch(`${API_BASE}/api/browser/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: "https://www.google.com" })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start session");
      }

      const session = await res.json();
      setSessionId(session.sessionId);
      setBrowserState("online");

      // 2. Open Socket.io Client
      const socket = io(API_BASE);
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log(`[Socket] Connected to server, joining session: ${session.sessionId}`);
        socket.emit("session:join", session.sessionId);
      });

      socket.on("frame:update", (payload: { sessionId: string; timestamp: number; image: string }) => {
        // Set image source
        setImageSrc(`data:image/jpeg;base64,${payload.image}`);
        
        // Calculate latency / RTT
        const latency = Date.now() - payload.timestamp;
        setRtt(latency > 0 ? latency : 0);
        
        // Count frame for FPS calculations
        frameCountRef.current += 1;
      });

      socket.on("disconnect", () => {
        console.log("[Socket] Disconnected from server");
      });

      // 3. Set FPS counting timer
      fpsIntervalRef.current = setInterval(() => {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
      }, 1000);

    } catch (err: any) {
      console.error("[Start] Error: ", err);
      setErrorMsg(err.message || "An unexpected error occurred during container startup");
      setBrowserState("offline");
    }
  };

  const handleTerminate = async () => {
    if (sessionId) {
      try {
        await fetch(`${API_BASE}/api/browser/${sessionId}/stop`, {
          method: "POST"
        });
      } catch (err) {
        console.error("[Stop] Error: ", err);
      }
    }

    // Cleanup resources
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }

    setSessionId(null);
    setImageSrc(null);
    setFps(0);
    setRtt(0);
    setBrowserState("offline");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                BrowserPilot
              </span>
              <span className="text-xs text-slate-500 ml-2 font-mono">v0.1.0</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Environment: Dev
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              Milestone 5 — Real-Time Streaming
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left Side: Control & Panel (4 Cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Project Overview Card */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-lg font-bold text-slate-100 mb-2">Platform Overview</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Local browser virtualization platform enabling remote execution of a Chromium browser isolated inside a Docker container.
            </p>
            <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Milestone Status:</span>
                <span className="text-indigo-400 font-medium font-mono">Frame Streaming Active</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Virtualization Mode:</span>
                <span className="text-slate-300 font-medium">Headless Playwright / Docker</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Socket Protocol:</span>
                <span className="text-slate-300 font-medium">Socket.io Event Gateway</span>
              </div>
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Sandbox Configuration
            </h2>

            <div className="flex flex-col gap-4">
              {errorMsg && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-400 font-sans leading-relaxed">
                  ⚠️ <strong>Startup Error:</strong> {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Browser Client</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" disabled>
                  <option>Chromium (Playwright Sandbox)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Width (Viewport)</label>
                  <input type="text" value="1280px" disabled className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono focus:outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Height (Viewport)</label>
                  <input type="text" value="720px" disabled className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono focus:outline-none cursor-not-allowed" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Egress Target</label>
                <input type="text" value="https://www.google.com" disabled className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono focus:outline-none cursor-not-allowed" />
              </div>

              <div className="border-t border-slate-850 pt-4 flex flex-col gap-3">
                {browserState === "offline" && (
                  <button 
                    onClick={handleProvision}
                    className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-750 text-white rounded-lg font-medium text-sm transition shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 flex items-center justify-center gap-2 group"
                  >
                    Launch Browser Session
                    <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                )}

                {browserState === "provisioning" && (
                  <button 
                    disabled
                    className="w-full h-11 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg font-medium text-sm transition cursor-wait flex items-center justify-center gap-2"
                  >
                    <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Spawning Container...
                  </button>
                )}

                {browserState === "online" && (
                  <button 
                    onClick={handleTerminate}
                    className="w-full h-11 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:text-rose-350 rounded-lg font-medium text-sm transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Terminate Sandbox Session
                  </button>
                )}
              </div>
            </div>
          </div>
          
        </section>

        {/* Right Side: Virtual Browser Display (8 Cols) */}
        <section className="lg:col-span-8 flex flex-col">
          <div className="rounded-xl border border-slate-900 bg-slate-900/30 backdrop-blur-sm overflow-hidden flex flex-col h-full shadow-2xl">
            
            {/* Header: Address & Controls */}
            <div className="bg-slate-950 border-b border-slate-900 px-4 py-3 flex items-center gap-4">
              
              {/* Navigation Arrows */}
              <div className="flex items-center gap-1.5 text-slate-500">
                <button className="p-1 hover:bg-slate-900 rounded transition duration-200 cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="p-1 hover:bg-slate-900 rounded transition duration-200 cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button className="p-1 hover:bg-slate-900 rounded transition duration-200 cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                  </svg>
                </button>
              </div>

              {/* URL Address Bar */}
              <div className="flex-1 flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono shadow-inner select-none">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{sessionId ? `https://browser.internal/session/${sessionId}` : "https://browser.internal/offline"}</span>
              </div>

              {/* Session Status Tag */}
              <div className="flex items-center gap-2 select-none">
                {browserState === "offline" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    OFFLINE
                  </span>
                )}
                {browserState === "provisioning" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    BOOTING
                  </span>
                )}
                {browserState === "online" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>

            </div>

            {/* Viewport Canvas Screen */}
            <div className="flex-1 min-h-[420px] bg-slate-950 relative flex items-center justify-center overflow-hidden select-none">
              
              {/* Grid Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.04),rgba(255,255,255,0))]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:24px_24px] opacity-10" />

              {/* State 1: OFFLINE screen */}
              {browserState === "offline" && (
                <div className="text-center z-10 flex flex-col items-center gap-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shadow-md">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-300 text-sm">No Active Session</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Initialize a containerized Chromium instance to view and interact with the remote viewport stream.
                    </p>
                  </div>
                  <button 
                    onClick={handleProvision}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/35 text-xs font-semibold rounded-lg transition"
                  >
                    Quick Launch
                  </button>
                </div>
              )}

              {/* State 2: PROVISIONING screen */}
              {browserState === "provisioning" && (
                <div className="text-center z-10 flex flex-col items-center gap-4 max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-md relative">
                    <div className="absolute inset-0 rounded-full border border-indigo-500/40 animate-ping" />
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-300 text-sm">Provisioning Isolated Container</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Allocating resources and configuring browser containers. Expected startup time: &lt; 2s.
                    </p>
                  </div>
                </div>
              )}

              {/* State 3: ONLINE / LIVE screen */}
              {browserState === "online" && (
                <div className="w-full h-full absolute inset-0 bg-slate-900 flex flex-col">
                  
                  {/* Browser Topbar */}
                  <div className="bg-slate-900 px-4 py-2 border-b border-slate-850 flex items-center justify-between text-xs text-slate-400 select-none">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                      <span className="font-medium text-[11px] text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800 ml-2">
                        Chromium v122 (Isolated)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      <span>FPS: {fps}</span>
                      <span className="text-slate-700">|</span>
                      <span>RTT: {rtt}ms</span>
                    </div>
                  </div>

                  {/* Browser Live Viewport */}
                  {imageSrc ? (
                    <div className="flex-1 bg-slate-950 flex items-center justify-center overflow-hidden relative">
                      <img 
                        src={imageSrc} 
                        className="max-w-full max-h-full object-contain pointer-events-none" 
                        alt="Live viewport stream" 
                      />
                    </div>
                  ) : (
                    <div className="flex-1 bg-slate-950 flex flex-col justify-center items-center text-center p-8 relative">
                      <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <h4 className="font-bold text-slate-200 text-sm tracking-tight">Awaiting Live Frame Feed...</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
                        Initializing WebSocket room subscription. Visual frames will stream in real-time as the container updates.
                      </p>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            <span>© 2026 BrowserPilot Project. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-help">Documentation</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-help">Milestone Details</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-help">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
