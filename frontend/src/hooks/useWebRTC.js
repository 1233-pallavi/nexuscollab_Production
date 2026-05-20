import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const useWebRTC = ({ roomId, userId, username }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callError, setCallError] = useState(null);

  const peerConnections = useRef({});
  // cameraStream: the getUserMedia stream — lives for the entire call duration
  const cameraStream = useRef(null);
  // screenStream: the getDisplayMedia stream — only alive while sharing
  const screenStream = useRef(null);
  // displayStream: what the local video tile shows (camera or screen)
  const displayStream = useRef(null);

  const socket = getSocket();

  // ─── PEER CONNECTION ────────────────────────────────────────────────────────

  const removePeer = useCallback((remoteSocketId) => {
    if (peerConnections.current[remoteSocketId]) {
      peerConnections.current[remoteSocketId].close();
      delete peerConnections.current[remoteSocketId];
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });
  }, []);

  const createPeerConnection = useCallback((remoteSocketId) => {
    if (peerConnections.current[remoteSocketId]) return peerConnections.current[remoteSocketId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add all tracks from the current camera stream
    if (cameraStream.current) {
      cameraStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, cameraStream.current);
      });
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams((prev) => ({ ...prev, [remoteSocketId]: stream }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', { targetSocketId: remoteSocketId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        removePeer(remoteSocketId);
      }
    };

    peerConnections.current[remoteSocketId] = pc;
    return pc;
  }, [socket, removePeer]);

  // ─── CALL ───────────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    try {
      setCallError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      cameraStream.current = stream;
      displayStream.current = stream;
      setLocalStream(stream);
      setIsInCall(true);
      setIsCameraOn(true);
      setIsMicOn(true);
      socket?.emit('call-start', { roomId });
      socket?.emit('call-join', { roomId });
    } catch (err) {
      setCallError(
        err.name === 'NotAllowedError'
          ? 'Camera/mic permission denied'
          : 'Failed to access media devices'
      );
    }
  }, [roomId, socket]);

  const endCall = useCallback(() => {
    // Close all peer connections
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

    // Stop every track on every stream
    [cameraStream, screenStream, displayStream].forEach((ref) => {
      if (ref.current) {
        ref.current.getTracks().forEach((t) => t.stop());
        ref.current = null;
      }
    });

    setLocalStream(null);
    setRemoteStreams({});
    setIsInCall(false);
    setIsCameraOn(true);
    setIsMicOn(true);
    setIsScreenSharing(false);
    setCallError(null);

    socket?.emit('call-leave', { roomId });
  }, [roomId, socket]);

  // ─── CAMERA TOGGLE ──────────────────────────────────────────────────────────
  // Use track.enabled — this is the correct WebRTC approach.
  // It mutes the video without stopping hardware (no restart needed, no stale ref issues).
  // The camera indicator light behaviour depends on the OS/browser — Chrome keeps it on
  // even with enabled=false, which is expected browser behaviour, not a bug.

  const toggleCamera = useCallback(() => {
    if (!cameraStream.current) return;
    const videoTrack = cameraStream.current.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  }, []);

  // ─── MIC TOGGLE ─────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (!cameraStream.current) return;
    const audioTrack = cameraStream.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  // ─── SCREEN SHARE ───────────────────────────────────────────────────────────

  const startScreenShare = useCallback(async () => {
    try {
      const sStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      screenStream.current = sStream;
      const screenTrack = sStream.getVideoTracks()[0];

      // Replace video sender in all peer connections
      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Build display stream: screen video + camera audio
      const audioTracks = cameraStream.current?.getAudioTracks() ?? [];
      const newDisplay = new MediaStream([screenTrack, ...audioTracks]);
      displayStream.current = newDisplay;
      setLocalStream(newDisplay);
      setIsScreenSharing(true);

      socket?.emit('screen-share-start', { roomId });

      // When user clicks browser "Stop sharing"
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      if (err.name !== 'NotAllowedError') setCallError('Failed to start screen sharing');
    }
  }, [roomId, socket]);

  const stopScreenShare = useCallback(() => {
    if (!screenStream.current) return;

    // Stop screen tracks
    screenStream.current.getTracks().forEach((t) => t.stop());
    screenStream.current = null;

    // Restore camera video track to all peer connections
    const cameraVideoTrack = cameraStream.current?.getVideoTracks()[0] ?? null;
    Object.values(peerConnections.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(cameraVideoTrack);
    });

    // Restore camera stream as the display stream
    // Re-use the existing cameraStream — do NOT call getUserMedia again
    displayStream.current = cameraStream.current;
    setLocalStream(cameraStream.current);
    setIsScreenSharing(false);

    socket?.emit('screen-share-stop', { roomId });
  }, [roomId, socket]);

  // ─── WEBRTC SIGNALING ───────────────────────────────────────────────────────

  const makeOffer = useCallback(async (remoteSocketId) => {
    const pc = createPeerConnection(remoteSocketId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('offer', { targetSocketId: remoteSocketId, offer, roomId });
    } catch (err) {
      console.error('Offer error:', err);
    }
  }, [createPeerConnection, roomId, socket]);

  const handleOffer = useCallback(async ({ offer, fromSocketId }) => {
    const pc = createPeerConnection(fromSocketId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('answer', { targetSocketId: fromSocketId, answer });
    } catch (err) {
      console.error('Answer error:', err);
    }
  }, [createPeerConnection, socket]);

  const handleAnswer = useCallback(async ({ answer, fromSocketId }) => {
    const pc = peerConnections.current[fromSocketId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Handle answer error:', err);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate, fromSocketId }) => {
    const pc = peerConnections.current[fromSocketId];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    }
  }, []);

  // ─── SOCKET LISTENERS ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peer-joined-call', ({ socketId }) => {
      if (isInCall) makeOffer(socketId);
    });
    socket.on('peer-left-call', ({ socketId }) => removePeer(socketId));

    return () => {
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-joined-call');
      socket.off('peer-left-call');
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate, isInCall, makeOffer, removePeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { endCall(); };
  }, []);

  return {
    localStream,
    remoteStreams,
    isInCall,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    callError,
    startCall,
    endCall,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare
  };
};

export default useWebRTC;
