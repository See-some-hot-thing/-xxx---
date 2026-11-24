const video = document.getElementById("videoPlayer");
const videoStage = document.getElementById("videoStage");
const playerWrapper = document.getElementById("playerWrapper");

const videoTitle = document.getElementById("videoTitle");
const speedBtn = document.getElementById("speedBtn");
const pipBtn = document.getElementById("pipBtn");

const rewindBtn = document.getElementById("rewindBtn");
const forwardBtn = document.getElementById("forwardBtn");
const centerPlayBtn = document.getElementById("centerPlayBtn");
const centerPlayIcon = document.getElementById("centerPlayIcon");

const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");
const seekSlider = document.getElementById("seekSlider");

const playPauseBtn = document.getElementById("playPauseBtn");
const bottomPlayIcon = document.getElementById("bottomPlayIcon");
const nextBtn = document.getElementById("nextBtn");
const muteBtn = document.getElementById("muteBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const likeBtn = document.getElementById("likeBtn");
const dislikeBtn = document.getElementById("dislikeBtn");
const saveBtn = document.getElementById("saveBtn");
const saveLabel = document.getElementById("saveLabel");
const downloadLink = document.getElementById("downloadLink");
const reportBtn = document.getElementById("reportBtn");

const playlist = [
  {
    title: "Shuuchuu Chiryou Shitsu 2",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  },
  {
    title: "Sample Video 02",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
  }
];

let currentIndex = 0;
let isSeeking = false;
let hideControlsTimer = null;

const speeds = [0.75, 1, 1.25, 1.5, 2];
let speedIndex = 1;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function updatePlayIcons(isPlaying) {
  const playPath = '<path d="M8 5v14l11-7z"></path>';
  const pausePath = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"></path>';
  centerPlayIcon.innerHTML = isPlaying ? pausePath : playPath;
  bottomPlayIcon.innerHTML = isPlaying ? pausePath : playPath;
  videoStage.classList.toggle("playing", isPlaying);
}

function togglePlay() {
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function loadVideo(index, autoPlay = false) {
  currentIndex = (index + playlist.length) % playlist.length;
  const item = playlist[currentIndex];
  videoTitle.textContent = item.title;
  video.src = item.src;
  downloadLink.href = item.src;
  seekSlider.value = 0;
  currentTimeEl.textContent = "0:00";
  video.load();
  if (autoPlay) {
    video.play().catch(() => {});
  }
}

function showControlsTemporarily() {
  videoStage.classList.remove("controls-hidden");
  clearTimeout(hideControlsTimer);
  if (!video.paused) {
    hideControlsTimer = setTimeout(() => {
      videoStage.classList.add("controls-hidden");
    }, 3000);
  }
}

// Playback & Seeking
centerPlayBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePlay();
});

playPauseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePlay();
});

rewindBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  video.currentTime = Math.max(0, video.currentTime - 10);
  showControlsTemporarily();
});

forwardBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (Number.isFinite(video.duration)) {
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
  }
  showControlsTemporarily();
});

nextBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  loadVideo(currentIndex + 1, true);
});

video.addEventListener("play", () => {
  updatePlayIcons(true);
  showControlsTemporarily();
});

video.addEventListener("pause", () => {
  updatePlayIcons(false);
  videoStage.classList.remove("controls-hidden");
  clearTimeout(hideControlsTimer);
});

video.addEventListener("loadedmetadata", () => {
  durationTimeEl.textContent = formatTime(video.duration);
});

video.addEventListener("timeupdate", () => {
  if (!isSeeking && Number.isFinite(video.duration) && video.duration > 0) {
    const percent = (video.currentTime / video.duration) * 100;
    seekSlider.value = percent;
    currentTimeEl.textContent = formatTime(video.currentTime);
  }
});

seekSlider.addEventListener("input", () => {
  isSeeking = true;
  if (Number.isFinite(video.duration)) {
    const previewTime = (seekSlider.value / 100) * video.duration;
    currentTimeEl.textContent = formatTime(previewTime);
  }
});

seekSlider.addEventListener("change", () => {
  if (Number.isFinite(video.duration)) {
    video.currentTime = (seekSlider.value / 100) * video.duration;
  }
  isSeeking = false;
  showControlsTemporarily();
});

// Speed, Mute, PiP, Fullscreen
speedBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  speedIndex = (speedIndex + 1) % speeds.length;
  const rate = speeds[speedIndex];
  video.playbackRate = rate;
  speedBtn.textContent = `${rate}x`;
});

muteBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  video.muted = !video.muted;
  muteBtn.style.opacity = video.muted ? "0.5" : "1";
});

pipBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
      await video.requestPictureInPicture();
    }
  } catch (_) {}
});

fullscreenBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    if (!document.fullscreenElement) {
      await playerWrapper.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {}
});

// Auto-hide controls on tap/move
videoStage.addEventListener("pointermove", showControlsTemporarily);
videoStage.addEventListener("click", () => {
  if (video.paused) {
    togglePlay();
  } else if (videoStage.classList.contains("controls-hidden")) {
    showControlsTemporarily();
  } else {
    videoStage.classList.add("controls-hidden");
  }
});

// Bottom Action Bar interactions
likeBtn.addEventListener("click", () => {
  const countEl = document.getElementById("likeCount");
  const dislikeCountEl = document.getElementById("dislikeCount");
  const isActive = likeBtn.classList.toggle("active");
  countEl.textContent = Number(countEl.textContent) + (isActive ? 1 : -1);

  if (isActive && dislikeBtn.classList.contains("active")) {
    dislikeBtn.classList.remove("active");
    dislikeCountEl.textContent = Number(dislikeCountEl.textContent) - 1;
  }
});

dislikeBtn.addEventListener("click", () => {
  const countEl = document.getElementById("dislikeCount");
  const likeCountEl = document.getElementById("likeCount");
  const isActive = dislikeBtn.classList.toggle("active");
  countEl.textContent = Number(countEl.textContent) + (isActive ? 1 : -1);

  if (isActive && likeBtn.classList.contains("active")) {
    likeBtn.classList.remove("active");
    likeCountEl.textContent = Number(likeCountEl.textContent) - 1;
  }
});

saveBtn.addEventListener("click", () => {
  const isSaved = saveBtn.classList.toggle("active");
  saveLabel.textContent = isSaved ? "Saved" : "Save";
});

reportBtn.addEventListener("click", () => {
  alert("Report submitted.");
});

// Initialize first video download link
downloadLink.href = playlist[0].src;
