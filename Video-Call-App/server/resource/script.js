// Connect to the signaling server
const socket = io();

// Extract room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

// Validate room
if (!roomId) {
  alert('Room ID is missing.');
  window.location.href = '/';
}

// Show room ID in UI (if applicable)
const roomIdDisplay = document.getElementById('room-id');
if (roomIdDisplay) {
  roomIdDisplay.textContent = roomId;
}

// Get video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Declare variables
let localStream;
let peerConnection;

// STUN server config
const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// 🔹 1. Get user's media stream
async function getMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Could not access media devices:', err);
    alert('Could not access camera/mic.');
  }
}

// 🔹 2. Create Peer Connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE candidate handling
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate, roomId);
    }
  };

  // Add local stream to connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
}

// 🔹 3. Socket - Join room
socket.emit('join-room', roomId);

// 🔹 4. When another user joins
socket.on('user-connected', async (userId) => {
  console.log('User connected:', userId);
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('offer', offer, roomId);
});

// 🔹 5. Receive offer
socket.on('offer', async (offer) => {
  console.log('Received offer');
  createPeerConnection();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', answer, roomId);
});

// 🔹 6. Receive answer
socket.on('answer', async (answer) => {
  console.log('Received answer');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// 🔹 7. Receive ICE candidate
socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Failed to add ICE candidate:', error);
  }
});

// Start it
getMedia();
