import { db, ref, onValue, set } from '/firebase.js';

const peer = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

const roomId = location.hash.slice(1) || Math.random().toString(36).substring(2);
const isViewer = location.pathname.includes('room');

const roomRef = ref(db, `rooms/${roomId}`);

if (isViewer) {
  // ===== ВИЗУАЛИЗАТОР =====
  const remoteVideo = document.getElementById('remoteVideo');
  const status = document.getElementById('status');

  peer.ontrack = (event) => {
    console.log("✅ Received track");
    remoteVideo.srcObject = event.streams[0];
    status.textContent = "✅ Stream is live!";
  };

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      set(ref(db, `rooms/${roomId}/viewerIce`), e.candidate.toJSON());
    }
  };

  onValue(roomRef, async (snap) => {
    const data = snap.val();
    if (!data || !data.offer) return;

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await set(roomRef, { ...data, answer });
    } catch (e) {
      console.error("Viewer error:", e);
    }

    if (data.sharerIce) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(data.sharerIce));
      } catch (e) {
        console.error("Error adding sharer ICE:", e);
      }
    }
  });

} else {
  // ===== ШАРЕР =====
  const link = document.getElementById('link');
  const status = document.getElementById('status');
  const preview = document.getElementById('localPreview');
  const startBtn = document.getElementById('start');

  link.textContent = `${location.origin}/room.html#${roomId}`;

  startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    preview.srcObject = stream;
    preview.style.display = 'block';
    status.style.display = 'block';

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await set(roomRef, { offer });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        set(ref(db, `rooms/${roomId}/sharerIce`), e.candidate.toJSON());
      }
    };

    onValue(roomRef, async (snap) => {
      const data = snap.val();
      if (data?.answer && peer.signalingState === 'have-local-offer') {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          console.warn("⚠️ setRemoteDescription error (sharer):", e);
        }
      }

      if (data.viewerIce) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(data.viewerIce));
        } catch (e) {
          console.warn("⚠️ Error adding viewer ICE:", e);
        }
      }
    });
  };
}
