import { db, ref, onValue, set } from './firebase.js';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const roomId = location.hash.substring(1) || Math.random().toString(36).substring(2);
const isViewer = location.pathname.includes('room');
const peer = new RTCPeerConnection(configuration);

if (isViewer) {
  const video = document.getElementById('remoteVideo');

  peer.ontrack = (e) => {
    video.srcObject = e.streams[0];
  };

  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, async (snapshot) => {
    const data = snapshot.val();
    if (data?.offer && !peer.currentRemoteDescription) {
      await peer.setRemoteDescription(data.offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await set(roomRef, { ...data, answer });
    }

    if (data?.iceCandidate) {
      try {
        await peer.addIceCandidate(data.iceCandidate);
      } catch (e) {}
    }
  });

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      set(ref(db, `rooms/${roomId}/iceCandidate`), event.candidate.toJSON());
    }
  };
} else {
  document.getElementById('link').innerText = `${location.origin}/room.html#${roomId}`;
  document.getElementById('start').onclick = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await set(ref(db, `rooms/${roomId}`), { offer });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        set(ref(db, `rooms/${roomId}/iceCandidate`), event.candidate.toJSON());
      }
    };

    const roomRef = ref(db, `rooms/${roomId}`);
    onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (data?.answer && !peer.currentRemoteDescription) {
        await peer.setRemoteDescription(data.answer);
      }
    });
  };
}
