import { db, ref, onValue, set } from '/firebase.js';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const roomId = location.hash.substring(1) || Math.random().toString(36).substring(2);
const isViewer = location.pathname.includes('room');
const peer = new RTCPeerConnection(configuration);

if (isViewer) {
  // 🎥 Viewer
  const video = document.getElementById('remoteVideo');

    peer.ontrack = (e) => {
    console.log("✅ Viewer received stream!", e.streams[0]);
    video.srcObject = e.streams[0];

    // Попытка воспроизведения сразу
    setTimeout(() => {
        video.play().then(() => {
        document.getElementById('status').innerText = "✅ Stream is live!";
        }).catch(err => {
        console.error("🚫 Failed to autoplay:", err);
        document.getElementById('status').innerText = "⚠️ Click the play button to start the stream";
        });
    }, 200);
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
  // 🖥 Sharer
  const linkEl = document.getElementById('link');
  const startBtn = document.getElementById('start');
  const statusEl = document.getElementById('status');
  const preview = document.getElementById('localPreview');

  linkEl.innerText = `${location.origin}/room.html#${roomId}`;

  startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    console.log("🖥️ Stream captured:", stream);

    // Show status + preview
    statusEl.style.display = 'block';
    preview.srcObject = stream;
    preview.style.display = 'block';

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

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (
    data?.answer &&
    peer.signalingState === 'have-local-offer' &&
    !peer.remoteDescription
    ) {
    console.log("📨 Answer received by sharer");
    try {
        await peer.setRemoteDescription(data.answer);
    } catch (e) {
        console.warn("⚠️ setRemoteDescription error (sharer):", e);
    }
}

    });
  };
}
