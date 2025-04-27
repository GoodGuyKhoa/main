// Connect to the signaling server
const socket = io();

// Extract room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (!roomId) {
  alert('Room ID is missing.');
  window.location.href = '/';
}

// Display room ID
document.getElementById('room-id').textContent = roomId;

// HTML video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Variables for peer connection and media stream
let localStream;
let peerConnection;

// WebRTC STUN servers (public)
const servers = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302', // Google's free STUN server
    },
  ],
};

// 1. Get media stream (camera and mic)
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

// 2. Initialize peer connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  // When remote stream arrives, show it
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Send any ice candidates to the other peer
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, roomId);
    }
  };

  // Add local stream tracks to peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
}

// 3. Handle joining the room
socket.emit('join-room', roomId);

// 4. When another user connects
socket.on('user-connected', async (userId) => {
  console.log('User connected:', userId);
  createPeerConnection();

  // Create an offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Send the offer to the other user
  socket.emit('offer', offer, roomId);
});

// 5. When an offer is received
socket.on('offer', async (offer) => {
  console.log('Received offer');
  createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  // Create and send an answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomId);
});

// 6. When an answer is received
socket.on('answer', async (answer) => {
  console.log('Received answer');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// 7. When an ICE candidate is received
socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding received ice candidate', error);
  }
});

// Start the app
getMedia();
