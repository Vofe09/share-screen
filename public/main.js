import { db, ref, onValue, set } from '/firebase.js';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const roomId = location.hash.substring(1) || Math.random().toString(36).substring(2);
const isViewer = location.pathname.includes('room');
const peer = new RTCPeerConnection(configuration);

if (isViewer) {
  // 🎥 Viewer logic
  const video = document.getElementById('remoteVideo');
  const status = document.getElementById('status');

  peer.ontrack = (e) => {
    console.log("✅ Viewer received stream!", e.streams[0]);
    video.srcObject = e.streams[0];
    video.onloadedmetadata = () => {
      video.play().catch(err => console.error("🚫 play() error:", err));
    };
    status.innerText = '✅ Stream is live!';
    status.style.color = 'lime';
  };

  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, async (snapshot) => {
    const data = snapshot.val();
    if (data?.offer && !peer.currentRemoteDescription) {
      console.log("📡 Offer received by viewer");
      await peer.setRemoteDescription(data.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await set(roomRef, { ...data, answer });
      console.log("📨 Answer sent to Firebase");
    }

    if (data?.iceCandidate) {
      try {
        await peer.addIceCandidate(data.iceCandidate);
        console.log("📡 ICE candidate added by viewer");
      } catch (e) {
        console.error("ICE error (viewer):", e);
      }
    }
  });

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      set(ref(db, `rooms/${roomId}/iceCandidate`), event.candidate.toJSON());
      console.log("📤 ICE candidate sent by viewer");
    }
  };

} else {
  // 🖥 Sharer logic
  const linkEl = document.getElementById('link');
  const startBtn = document.getElementById('start');
  const statusEl = document.getElementById('status');
  const preview = document.getElementById('localPreview');

  linkEl.innerText = `${location.origin}/room.html#${roomId}`;

  startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    console.log("🖥️ Stream captured:", stream);

    // Show status + preview
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerText = '🟢 You are streaming!';
    }

    if (preview) {
      preview.srcObject = stream;
      preview.style.display = 'block';
    }

    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    console.log("🖥️ Sharing screen...");

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await set(ref(db, `rooms/${roomId}`), { offer });
    console.log("📡 Offer written to Firebase");

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        set(ref(db, `rooms/${roomId}/iceCandidate`), event.candidate.toJSON());
        console.log("📤 ICE candidate sent by sharer");
      }
    };

    // 🛠 Флаг, чтобы не применять ответ повторно
    let remoteSet = false;

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (data?.answer && !remoteSet) {
        try {
          await peer.setRemoteDescription(data.answer);
          console.log("📨 Answer received and applied by sharer");
          remoteSet = true;
        } catch (e) {
          console.warn("⚠️ setRemoteDescription error (sharer):", e);
        }
      }
    });
  };
}
