"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Send,
  ShieldCheck,
  Video,
  VideoOff,
  Wifi,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/ui/misc";

type Role = "doctor" | "patient";
type SignalType = "join" | "offer" | "answer" | "candidate" | "leave" | "chat";
type Signal = { id: number; sender: Role; type: SignalType; payload: string; createdAt: string };
type ChatMsg = { id: number; sender: Role; text: string; at: string };
type PeerState = "waiting" | "connecting" | "connected" | "reconnecting";
type Phase = "lobby" | "call" | "left" | "ended";

type Props = {
  code: string;
  role: Role;
  self: { name: string; color: string };
  peer: { name: string; color: string; subtitle: string };
  slotLabel: string;
  fee: number;
  inPersonFee: number;
  paid: boolean;
  initialCursor: number;
  initialChat: ChatMsg[];
  backHref: string;
  workspaceHref?: string;
  endAction?: () => Promise<void>;
  patientInfo?: {
    uhid: string;
    ageSex: string;
    allergies: string | null;
    conditions: string | null;
    reason: string | null;
    bloodGroup: string | null;
  };
  footerNote?: ReactNode;
};

const ICE: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function newSid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

/**
 * 1:1 video consultation room. Peer-to-peer WebRTC media; signalling is
 * relayed through /api/rtc/[code] (HTTP polling). The doctor always makes the
 * offer: whenever the patient (re)joins, the doctor starts a fresh session.
 */
export function VideoRoom(props: Props) {
  const { code, role, self, peer, backHref, workspaceHref, endAction, patientInfo } = props;
  const api = `/api/rtc/${encodeURIComponent(code)}`;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerState, setPeerState] = useState<PeerState>("waiting");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(props.initialChat);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [completed, setCompleted] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sidRef = useRef<string | null>(null);
  const cursorRef = useRef(props.initialCursor);
  const myJoinIdRef = useRef(0);
  const chatOpenRef = useRef(false);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  const lobbyRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasVideoTrack = !!stream?.getVideoTracks().length;
  const hasAudioTrack = !!stream?.getAudioTracks().length;

  /* ------------------------------------------------------------ local media */
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaNote("This browser can't reach your camera on this connection. Open the site over HTTPS (or on localhost) to be seen and heard.");
        setMediaLoading(false);
        return;
      }
      let s: MediaStream | null = null;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        try {
          s = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMediaNote("Camera not available — you'll join with audio only.");
        } catch {
          setMediaNote("Camera and microphone are blocked. You can still join to see and hear the other person; allow access from your browser's address bar to be seen and heard.");
        }
      }
      if (cancelled) {
        s?.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = s;
      setStream(s);
      setMediaLoading(false);
    }
    acquire();
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  // Attach the local preview to whichever element is on screen.
  useEffect(() => {
    for (const el of [lobbyRef.current, pipRef.current]) {
      if (el && el.srcObject !== stream) el.srcObject = stream;
    }
  }, [stream, phase, camOn]);

  useEffect(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn, stream]);
  useEffect(() => {
    stream?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn, stream]);

  /* ------------------------------------------------------------ call timer */
  useEffect(() => {
    if (!connectedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [connectedAt]);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatOpen, messages.length]);

  /* ------------------------------------------------------ signalling engine */
  useEffect(() => {
    if (phase !== "call") return;
    let alive = true;
    let outQueue: RTCIceCandidateInit[] = [];
    let canSend = false;
    let inPending: RTCIceCandidateInit[] = [];

    async function post(type: SignalType, payload: unknown) {
      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, payload: typeof payload === "string" ? payload : JSON.stringify(payload) }),
        });
        if (res.status === 401 || res.status === 403) setFatal("Your session has expired. Please sign in again to rejoin.");
        return res.ok ? ((await res.json()) as { id: number; createdAt: string }) : null;
      } catch {
        return null;
      }
    }

    function closePc() {
      const pc = pcRef.current;
      pcRef.current = null;
      sidRef.current = null;
      outQueue = [];
      canSend = false;
      inPending = [];
      if (pc) {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      setHasRemoteVideo(false);
    }

    function createPc(sid: string) {
      closePc();
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;
      sidRef.current = sid;
      pc.onicecandidate = (e) => {
        if (!e.candidate || pcRef.current !== pc) return;
        const c = e.candidate.toJSON();
        if (canSend) void post("candidate", { sid, candidate: c });
        else outQueue.push(c);
      };
      pc.ontrack = (e) => {
        if (pcRef.current !== pc) return;
        const remote = e.streams[0] ?? new MediaStream([e.track]);
        const el = remoteVideoRef.current;
        if (el && el.srcObject !== remote) {
          el.srcObject = remote;
          el.play().catch(() => {});
        }
        const update = () => setHasRemoteVideo(remote.getVideoTracks().some((t) => t.readyState === "live" && !t.muted));
        e.track.onunmute = update;
        e.track.onmute = update;
        e.track.onended = update;
        update();
      };
      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const st = pc.connectionState;
        if (st === "connected") {
          setPeerState("connected");
          setConnectedAt((t) => t ?? Date.now());
        } else if (st === "disconnected") {
          setPeerState("reconnecting");
        } else if (st === "failed") {
          setPeerState("reconnecting");
          if (role === "doctor") void makeOffer();
        }
      };
      return pc;
    }

    function flushOut(sid: string) {
      canSend = true;
      const q = outQueue;
      outQueue = [];
      for (const c of q) void post("candidate", { sid, candidate: c });
    }

    function addLocal(pc: RTCPeerConnection, offerer: boolean) {
      const s = localStreamRef.current;
      const kinds = new Set<string>();
      if (s) {
        for (const t of s.getTracks()) {
          pc.addTrack(t, s);
          kinds.add(t.kind);
        }
      }
      // Without a camera/mic we still want to receive the other side.
      if (offerer) for (const k of ["audio", "video"]) if (!kinds.has(k)) pc.addTransceiver(k, { direction: "recvonly" });
    }

    async function makeOffer() {
      const sid = newSid();
      const pc = createPc(sid);
      addLocal(pc, true);
      setPeerState("connecting");
      try {
        await pc.setLocalDescription(await pc.createOffer());
        if (pcRef.current !== pc) return;
        await post("offer", { sid, sdp: pc.localDescription });
        flushOut(sid);
      } catch (err) {
        console.error("offer failed", err);
      }
    }

    async function onOffer(data: { sid: string; sdp: RTCSessionDescriptionInit }) {
      const pc = createPc(data.sid);
      setPeerState("connecting");
      try {
        await pc.setRemoteDescription(data.sdp);
        addLocal(pc, false);
        await pc.setLocalDescription(await pc.createAnswer());
        if (pcRef.current !== pc) return;
        await post("answer", { sid: data.sid, sdp: pc.localDescription });
        flushOut(data.sid);
        for (const c of inPending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } catch (err) {
        console.error("answer failed", err);
      }
    }

    async function onAnswer(data: { sid: string; sdp: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc || data.sid !== sidRef.current || pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(data.sdp);
        for (const c of inPending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      } catch (err) {
        console.error("remote answer failed", err);
      }
    }

    async function onCandidate(data: { sid: string; candidate: RTCIceCandidateInit }) {
      const pc = pcRef.current;
      if (!pc || data.sid !== sidRef.current) return;
      if (!pc.remoteDescription) inPending.push(data.candidate);
      else await pc.addIceCandidate(data.candidate).catch(() => {});
    }

    async function handle(s: Signal) {
      if (s.type === "chat") {
        setMessages((prev) => (prev.some((m) => m.id === s.id) ? prev : [...prev, { id: s.id, sender: s.sender, text: s.payload, at: s.createdAt }]));
        if (s.sender !== role && !chatOpenRef.current) setUnread((u) => u + 1);
        return;
      }
      if (s.sender === role) return;
      let data: unknown = null;
      if (s.type === "offer" || s.type === "answer" || s.type === "candidate") {
        try {
          data = JSON.parse(s.payload);
        } catch {
          return;
        }
      }
      switch (s.type) {
        case "join":
          if (role === "doctor") await makeOffer();
          else if (s.id > myJoinIdRef.current) {
            // Doctor started a fresh session after we joined — announce ourselves again.
            closePc();
            setPeerState("connecting");
            const r = await post("join", "");
            if (r) myJoinIdRef.current = r.id;
          }
          break;
        case "offer":
          if (role === "patient") await onOffer(data as { sid: string; sdp: RTCSessionDescriptionInit });
          break;
        case "answer":
          if (role === "doctor") await onAnswer(data as { sid: string; sdp: RTCSessionDescriptionInit });
          break;
        case "candidate":
          await onCandidate(data as { sid: string; candidate: RTCIceCandidateInit });
          break;
        case "leave":
          closePc();
          setPeerState("waiting");
          setConnectedAt(null);
          if (s.payload === "ended" && role === "patient") setPhase("ended");
          break;
      }
    }

    async function run() {
      setPeerState("waiting");
      const joined = await post("join", "");
      if (joined) myJoinIdRef.current = joined.id;
      while (alive) {
        try {
          const res = await fetch(`${api}?after=${cursorRef.current}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { signals: Signal[]; status: string };
            for (const s of data.signals) {
              if (!alive) break;
              cursorRef.current = Math.max(cursorRef.current, s.id);
              await handle(s);
            }
            if (data.status === "completed") setCompleted(true);
            if (data.status === "cancelled") {
              setPhase("ended");
              break;
            }
          } else if (res.status === 401 || res.status === 403) {
            setFatal("Your session has expired. Please sign in again to rejoin.");
            break;
          }
        } catch {
          /* network blip — keep polling */
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    void run();

    const sendLeave = () => {
      const body = JSON.stringify({ type: "leave", payload: "" });
      if (navigator.sendBeacon) navigator.sendBeacon(api, new Blob([body], { type: "application/json" }));
      else void fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    };
    window.addEventListener("pagehide", sendLeave);

    return () => {
      alive = false;
      window.removeEventListener("pagehide", sendLeave);
      closePc();
      sendLeave();
      setPeerState("waiting");
      setConnectedAt(null);
    };
  }, [phase, api, role]);

  /* ------------------------------------------------------------------- chat */
  async function sendChat(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "chat", payload: text.slice(0, 1000) }) });
      if (res.ok) {
        const r = (await res.json()) as { id: number; createdAt: string };
        setMessages((prev) => (prev.some((m) => m.id === r.id) ? prev : [...prev, { id: r.id, sender: role, text, at: r.createdAt }]));
      }
    } catch {
      setDraft(text);
    }
  }

  /* ---------------------------------------------------------------- screens */
  if (fatal) {
    return (
      <CenterScreen icon={<AlertTriangle />} title="Connection interrupted">
        <p>{fatal}</p>
        <div className="mt-6 flex justify-center gap-2">
          <a href={`/login?next=/consult/${code}`} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-800">
            Sign in again
          </a>
        </div>
      </CenterScreen>
    );
  }

  if (phase === "ended") {
    return (
      <CenterScreen icon={<CheckCircle2 />} title="Consultation ended">
        <p>{peer.name} has ended the video consultation. Your prescription and diet plan will appear in your portal as soon as they are issued.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href={backHref} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-800">
            Back to appointment
          </Link>
          {role === "patient" && (
            <Link href="/patient/prescriptions" className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20">
              My prescriptions
            </Link>
          )}
        </div>
      </CenterScreen>
    );
  }

  if (phase === "left") {
    return (
      <CenterScreen icon={<LogOut />} title="You left the call">
        <p>The consultation is still open. You can rejoin while it is in progress.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={() => setPhase("call")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-800">
            <RotateCcw className="size-4" /> Rejoin
          </button>
          <Link href={backHref} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20">
            {role === "doctor" ? "Open workspace" : "Back to appointment"}
          </Link>
        </div>
      </CenterScreen>
    );
  }

  if (phase === "lobby") {
    return (
      <main className="min-h-dvh bg-brand-950 text-brand-100">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">Video consultation</p>
              <p className="tabular text-xs text-brand-300">{code}</p>
            </div>
          </div>
          <Link href={backHref} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-200 hover:bg-white/10 hover:text-white">
            Cancel
          </Link>
        </header>

        <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8 lg:pt-6">
          {/* Device preview */}
          <section>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-black ring-1 ring-white/10 sm:aspect-video">
              {hasVideoTrack && camOn ? (
                <video ref={lobbyRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <Avatar name={self.name} color={self.color} size="xl" className="mx-auto" />
                    <p className="mt-3 text-sm text-brand-300">{mediaLoading ? "Starting camera…" : camOn ? "Camera unavailable" : "Camera is off"}</p>
                  </div>
                </div>
              )}
              {mediaLoading && <Loader2 className="absolute right-4 top-4 size-5 animate-spin text-white/70" />}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
                <RoundButton label={micOn ? "Mute microphone" : "Unmute microphone"} active={micOn} disabled={!hasAudioTrack} onClick={() => setMicOn((v) => !v)}>
                  {micOn && hasAudioTrack ? <Mic /> : <MicOff />}
                </RoundButton>
                <RoundButton label={camOn ? "Turn camera off" : "Turn camera on"} active={camOn} disabled={!hasVideoTrack} onClick={() => setCamOn((v) => !v)}>
                  {camOn && hasVideoTrack ? <Video /> : <VideoOff />}
                </RoundButton>
              </div>
            </div>
            {mediaNote && (
              <p className="mt-3 flex gap-2 rounded-xl bg-warning-50 px-3.5 py-3 text-sm text-warning-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {mediaNote}
              </p>
            )}
          </section>

          {/* Join card */}
          <section className="rounded-3xl bg-white p-5 text-ink-700 shadow-lift sm:p-6">
            <div className="flex items-center gap-3.5">
              <Avatar name={peer.name} color={peer.color} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">{role === "patient" ? "Your doctor" : "Your patient"}</p>
                <p className="truncate font-display text-lg font-bold text-ink-900">{peer.name}</p>
                <p className="truncate text-sm text-ink-500">{peer.subtitle}</p>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface px-3.5 py-3">
                <dt className="text-xs text-ink-500">Slot</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">{props.slotLabel}</dd>
              </div>
              <div className="rounded-xl bg-surface px-3.5 py-3">
                <dt className="text-xs text-ink-500">Video consult fee</dt>
                <dd className="mt-0.5 font-semibold text-ink-900">
                  {rupees(props.fee)} <span className={cn("ml-1 text-xs font-semibold", props.paid ? "text-success-700" : "text-warning-700")}>{props.paid ? "Paid" : "Pending"}</span>
                </dd>
              </div>
            </dl>
            {props.inPersonFee > props.fee && (
              <p className="mt-2 text-xs text-ink-500">
                In-person OPD visit is {rupees(props.inPersonFee)} — {role === "patient" ? "you save" : "patient saves"} {rupees(props.inPersonFee - props.fee)} with a video consult.
              </p>
            )}

            {patientInfo && (
              <div className="mt-5 rounded-xl border border-line p-3.5 text-sm">
                <p className="font-semibold text-ink-900">Patient summary</p>
                <p className="mt-1 text-ink-600">
                  UHID {patientInfo.uhid} · {patientInfo.ageSex}
                  {patientInfo.bloodGroup ? ` · ${patientInfo.bloodGroup}` : ""}
                </p>
                {patientInfo.reason && <p className="mt-1 text-ink-600">Reason: {patientInfo.reason}</p>}
                {patientInfo.conditions && <p className="mt-1 text-ink-600">Conditions: {patientInfo.conditions}</p>}
                {patientInfo.allergies && <p className="mt-1 font-semibold text-danger-700">Allergies: {patientInfo.allergies}</p>}
              </div>
            )}

            <button
              type="button"
              disabled={mediaLoading}
              onClick={() => setPhase("call")}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {mediaLoading ? <Loader2 className="size-5 animate-spin" /> : <Video className="size-5" />}
              {role === "doctor" ? "Start consultation" : "Join consultation"}
            </button>

            <ul className="mt-5 space-y-2 text-sm text-ink-600">
              <li className="flex gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden /> Sit in a quiet, well-lit place facing the light.
              </li>
              <li className="flex gap-2">
                <Wifi className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden /> Use Wi-Fi or a strong 4G/5G signal.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> Audio and video go directly between you and {role === "patient" ? "your doctor" : "the patient"} — nothing is recorded.
              </li>
            </ul>
            {props.footerNote && <p className="mt-4 border-t border-line pt-4 text-xs text-ink-500">{props.footerNote}</p>}
          </section>
        </div>
      </main>
    );
  }

  /* ----------------------------------------------------------- in the call */
  const statusText =
    peerState === "connected"
      ? `Connected · ${clock(now - (connectedAt ?? now))}`
      : peerState === "connecting"
        ? "Connecting…"
        : peerState === "reconnecting"
          ? "Reconnecting…"
          : `Waiting for ${peer.name} to join…`;

  return (
    <div className="fixed inset-0 flex bg-ink-950 text-white">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {/* Remote video (also carries remote audio) */}
        <video ref={remoteVideoRef} autoPlay playsInline className={cn("absolute inset-0 h-full w-full bg-black object-cover sm:object-contain", !hasRemoteVideo && "opacity-0")} />
        {!hasRemoteVideo && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <span className={cn("inline-block rounded-full", peerState === "waiting" && "animate-pulse-ring")}>
                <Avatar name={peer.name} color={peer.color} size="xl" />
              </span>
              <p className="mt-4 font-display text-xl font-semibold">{peer.name}</p>
              <p className="mt-1 text-sm text-white/60">
                {peerState === "connected" ? "Camera is off" : peerState === "waiting" ? (role === "patient" ? "The doctor will join shortly. Please stay on this page." : "The patient hasn't joined yet.") : statusText}
              </p>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-semibold">{peer.name}</p>
            <p className="truncate text-xs text-white/70">{peer.subtitle}</p>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur",
                peerState === "connected" ? "bg-success-600/90" : peerState === "reconnecting" ? "bg-warning-600/90" : "bg-white/15",
              )}
            >
              <span className={cn("size-1.5 rounded-full bg-white", peerState !== "connected" && "animate-pulse")} />
              <span className="tabular">{statusText}</span>
            </span>
          </div>
          <div className="hidden shrink-0 text-right text-xs text-white/70 sm:block">
            <p className="tabular">{code}</p>
            <p>
              Video consult · {rupees(props.fee)} {props.paid ? "paid" : ""}
            </p>
          </div>
        </div>

        {patientInfo?.allergies && (
          <div className="absolute left-4 top-28 max-w-[70%] rounded-lg bg-danger-600/90 px-2.5 py-1 text-xs font-semibold backdrop-blur sm:left-6">
            Allergies: {patientInfo.allergies}
          </div>
        )}

        {completed && (
          <div className="absolute inset-x-4 top-28 mx-auto max-w-md rounded-xl bg-success-600/95 px-4 py-2.5 text-center text-sm font-medium backdrop-blur sm:top-24">
            {role === "patient" ? "Your prescription has been issued — you'll find it in your portal after the call." : "Consultation marked complete. You can end the call when ready."}
          </div>
        )}

        {/* Self view */}
        <div className="absolute bottom-28 right-3 w-28 overflow-hidden rounded-2xl bg-ink-800 shadow-lift ring-2 ring-white/20 sm:bottom-24 sm:right-6 sm:w-52">
          <div className="aspect-[3/4] sm:aspect-video">
            {hasVideoTrack && camOn ? (
              <video ref={pipRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="grid h-full place-items-center">
                <Avatar name={self.name} color={self.color} size="md" />
              </div>
            )}
          </div>
          {!micOn && (
            <span className="absolute left-1.5 top-1.5 rounded-md bg-danger-600 p-1" title="You are muted">
              <MicOff className="size-3" />
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-10">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-2.5 sm:gap-3">
            <RoundButton label={micOn ? "Mute" : "Unmute"} active={micOn} disabled={!hasAudioTrack} onClick={() => setMicOn((v) => !v)}>
              {micOn && hasAudioTrack ? <Mic /> : <MicOff />}
            </RoundButton>
            <RoundButton label={camOn ? "Camera off" : "Camera on"} active={camOn} disabled={!hasVideoTrack} onClick={() => setCamOn((v) => !v)}>
              {camOn && hasVideoTrack ? <Video /> : <VideoOff />}
            </RoundButton>
            <RoundButton
              label="Chat"
              active={!chatOpen}
              onClick={() => {
                setUnread(0);
                setChatOpen((v) => !v);
              }}
              badge={unread}
            >
              <MessageSquare />
            </RoundButton>
            {workspaceHref && (
              <a
                href={workspaceHref}
                target="_blank"
                rel="noreferrer"
                className="grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:flex sm:h-12 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm sm:font-semibold [&_svg]:size-5"
                title="Open notes & prescription in a new tab"
              >
                <FileText />
                <span className="hidden sm:inline">Notes &amp; Rx</span>
                <ExternalLink className="hidden size-3.5! opacity-70 sm:inline" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setPhase("left")}
              className="grid size-12 place-items-center rounded-full bg-danger-600 text-white shadow-lg transition hover:bg-danger-700 sm:size-14 [&_svg]:size-6"
              aria-label="Leave call"
              title="Leave call"
            >
              <PhoneOff />
            </button>
            {endAction && (
              <form action={endAction} onSubmit={() => setEnding(true)}>
                <button
                  type="submit"
                  disabled={ending}
                  className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink-900 shadow-lg transition hover:bg-brand-50 disabled:opacity-60"
                  title="End the call and mark the consultation complete"
                >
                  {ending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-success-600" />}
                  <span className="hidden sm:inline">End &amp; complete</span>
                  <span className="sm:hidden">End</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel: bottom sheet on phones, sidebar on laptops */}
      {chatOpen && (
        <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[65dvh] flex-col rounded-t-3xl bg-white text-ink-800 shadow-lift sm:static sm:h-auto sm:w-[22rem] sm:rounded-none sm:border-l sm:border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="font-semibold text-ink-900">Chat</p>
              <p className="text-xs text-ink-500">Messages are saved with this consultation</p>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} className="rounded-lg p-2 text-ink-500 hover:bg-surface" aria-label="Close chat">
              <X className="size-5" />
            </button>
          </div>
          {patientInfo && (
            <div className="border-b border-line bg-surface px-4 py-2.5 text-xs text-ink-600">
              UHID {patientInfo.uhid} · {patientInfo.ageSex}
              {patientInfo.conditions ? ` · ${patientInfo.conditions}` : ""}
            </div>
          )}
          <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {messages.length === 0 && <p className="py-8 text-center text-sm text-ink-400">No messages yet. Share reports or questions here.</p>}
            {messages.map((m) => {
              const mine = m.sender === role;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-surface-2 text-ink-800")}>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={cn("mt-0.5 text-[0.6875rem]", mine ? "text-brand-100" : "text-ink-400")}>{timeOf(m.at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} className="flex gap-2 border-t border-line p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1000}
              placeholder="Type a message"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong px-3.5 text-[0.9375rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
              aria-label="Message"
            />
            <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50" disabled={!draft.trim()} aria-label="Send">
              <Send className="size-4" />
            </button>
          </form>
        </aside>
      )}
    </div>
  );
}

function RoundButton({
  children,
  label,
  active,
  disabled,
  onClick,
  badge,
}: {
  children: ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={!active}
      className={cn(
        "relative grid size-12 place-items-center rounded-full backdrop-blur transition disabled:opacity-40 [&_svg]:size-5",
        active ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-ink-900 hover:bg-white/90",
      )}
    >
      {children}
      {!!badge && (
        <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[0.6875rem] font-bold leading-5 text-ink-950">{badge}</span>
      )}
    </button>
  );
}

function CenterScreen({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-950 px-5 py-10 text-center text-brand-100">
      <div className="max-w-md">
        <LogoMark className="mx-auto size-11" />
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-2xl bg-white/10 text-accent-500 [&_svg]:size-8">{icon}</div>
        <h1 className="mt-5 text-2xl font-bold text-white">{title}</h1>
        <div className="mt-2 text-[0.9375rem] leading-relaxed text-brand-200">{children}</div>
      </div>
    </main>
  );
}
