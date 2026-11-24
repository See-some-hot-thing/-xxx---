const DEFAULT_THUMB = "https://lh3.googleusercontent.com/aida-public/AB6AXuCYU1tgUo1HVlvVKqbjPyvMdEu1QeD-0DJgdlc_NZizO1MMTT4Au1CbMtcXze7xApFcL3m9n1NnHv1svw-LtrEfXD1RNN9gZO6gwlAkYL9A_byetE3dg6nLfwDdxug6S8ZL0gTFh8XUE3l1phEQNTJ3HMvh33wfsKnlOKBiUK-VRA8ZZKbG8UQKhggHEEWEGjUDuldumQAHrftHBlmsLNzSPKOvdKoaU7YOKPR0QWGNzGXb4i0yUsUR";

// ==========================================
// ANTI-DOWNLOAD / SHORTCUT BLOCKING
// ==========================================
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey && (e.key === "s" || e.key === "S" || e.key === "u" || e.key === "U")) ||
    (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I" || e.key === "j" || e.key === "J")) ||
    e.key === "F12"
  ) {
    e.preventDefault();
  }
  if (e.code === "Space" && document.activeElement.tagName !== "INPUT" && currentVideoId) {
    e.preventDefault();
    togglePlayPause();
  }
});

// ==========================================
// AD CONFIGURATION (Loaded AFTER Video)
// ==========================================
const AD_CONFIG = {
  popunderSrc: "https://abscloud.org/1/e6025b2f6245af1cdbbac6851eb3c2b8",
  banner320x50: {
    key: "30c51d3b7b4e9f007e1f43dfab8ac5c0",
    src: "https://bauval.org/22/30c51d3b7b4e9f007e1f43dfab8ac5c0",
    width: 320,
    height: 50
  },
  banner300x250: {
    key: "6104d8b774691024892059d0fb55ac0e",
    src: "https://bauval.org/22/6104d8b774691024892059d0fb55ac0e",
    width: 300,
    height: 250
  },
  nativeBanner: {
    src: "https://bauval.org/21/3f70743394b4399becdcd9c770f010ac",
    everyVideos: 4
  },
  socialBarSrc: "https://bauval.org/14/3ca91c9f7c933c4e4dc00b0183cff8c1",
  popunderEverySwitches: 4
};

const SPEEDS = [1, 1.25, 1.5, 2];
let speedIdx = 0;

let videos = [];
let currentVideoId = null;
let activeCategory = "All";
let activeFeedFilter = "all";
let searchQuery = "";
let videoSwitchCount = 0;
let popunderLoadedCount = 0;
let isFloating = false;
let manualMiniMode = false;
let controlsVisible = false;
let overlayHideTimer = null;
let scrollRafId = null;
let ignoreNextScrollDock = false;

let userState = JSON.parse(localStorage.getItem("vs_user_state")) || {
  likes: {},
  dislikes: {},
  favorites: {},
  subscriptions: {}
};

function saveUserState() {
  localStorage.setItem("vs_user_state", JSON.stringify(userState));
}

// ==========================================
// ALWAYS AUTOPLAY HELPER
// ==========================================
function ensureAutoplay(player) {
  if (!player || !player.src) return;
  const attemptPlay = player.play();
  if (attemptPlay && typeof attemptPlay.catch === "function") {
    attemptPlay.catch(() => {
      const prevMuted = player.muted;
      player.muted = true;
      player.play().then(() => {
        updateMuteIcons(player.muted);
      }).catch(() => {
        player.muted = prevMuted;
      });
    });
  }
}

// ==========================================
// CONTROLLER (NORMAL/FULL vs MINI)
// ==========================================
function formatShortTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateTimeAndProgress() {
  const player = document.getElementById("main-video-player");
  const curEl = document.getElementById("current-time-label");
  const durEl = document.getElementById("total-duration-label");
  const bar = document.getElementById("seek-progress-bar");

  if (curEl) curEl.textContent = formatShortTime(player.currentTime);
  if (durEl) durEl.textContent = formatShortTime(player.duration);

  if (bar && Number.isFinite(player.duration) && player.duration > 0) {
    bar.value = ((player.currentTime / player.duration) * 100).toFixed(2);
  }
}

function syncPlayPauseIcons() {
  const player = document.getElementById("main-video-player");
  const isPaused = player.paused || player.ended;

  document.querySelectorAll(".mini-icon-play, .ctrl-icon-play").forEach(el => {
    el.classList.toggle("hidden", !isPaused);
  });
  document.querySelectorAll(".mini-icon-pause, .ctrl-icon-pause").forEach(el => {
    el.classList.toggle("hidden", isPaused);
  });
}

function renderControllerVisibility() {
  const miniCtrl = document.getElementById("mini-player-controls");
  const fullCtrl = document.getElementById("full-video-controller");

  if (!currentVideoId || !controlsVisible || isFloating) {
    miniCtrl.classList.add("hidden");
    fullCtrl.classList.add("hidden");
    return;
  }

  miniCtrl.classList.add("hidden");
  fullCtrl.classList.remove("hidden");
}

function hideControlsNow() {
  controlsVisible = false;
  clearTimeout(overlayHideTimer);
  renderControllerVisibility();
}

function showControlsAndAutoHide(timeoutMs = 2400) {
  if (!currentVideoId || isFloating) return;
  controlsVisible = true;
  renderControllerVisibility();
  clearTimeout(overlayHideTimer);

  overlayHideTimer = setTimeout(() => {
    hideControlsNow();
  }, timeoutMs);
}

function togglePlayPause() {
  const player = document.getElementById("main-video-player");
  if (!currentVideoId || !player.src) return;

  if (player.paused || player.ended) {
    ensureAutoplay(player);
  } else {
    player.pause();
  }
  syncPlayPauseIcons();
  showControlsAndAutoHide(2400);
}

function handlePlayPauseClick(e) {
  if (e) e.stopPropagation();
  togglePlayPause();
}

function seekBySeconds(delta, e) {
  if (e) e.stopPropagation();
  const player = document.getElementById("main-video-player");
  if (!player.src) return;
  const dur = Number.isFinite(player.duration) ? player.duration : Infinity;
  player.currentTime = Math.min(Math.max(0, player.currentTime + delta), dur);
  updateTimeAndProgress();
  ensureAutoplay(player);
  showControlsAndAutoHide();
}

function handleSeekInput(val, e) {
  if (e) e.stopPropagation();
  const player = document.getElementById("main-video-player");
  if (!Number.isFinite(player.duration) || player.duration <= 0) return;
  player.currentTime = (Number(val) / 100) * player.duration;
  updateTimeAndProgress();
  ensureAutoplay(player);
  showControlsAndAutoHide();
}

function cyclePlaybackSpeed(e) {
  if (e) e.stopPropagation();
  const player = document.getElementById("main-video-player");
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  const nextSpeed = SPEEDS[speedIdx];
  player.playbackRate = nextSpeed;
  document.getElementById("speed-toggle-btn").textContent = `${nextSpeed}x`;
  showControlsAndAutoHide();
}

function updateMuteIcons(muted) {
  document.getElementById("icon-vol-on").classList.toggle("hidden", muted);
  document.getElementById("icon-vol-off").classList.toggle("hidden", !muted);
}

function toggleMute(e) {
  if (e) e.stopPropagation();
  const player = document.getElementById("main-video-player");
  player.muted = !player.muted;
  updateMuteIcons(player.muted);
  showControlsAndAutoHide();
}

function toggleFullscreen(e) {
  if (e) e.stopPropagation();
  const box = document.getElementById("player-box");
  if (isFloating) {
    exitFloatingMode();
  }
  if (!document.fullscreenElement) {
    if (box.requestFullscreen) {
      box.requestFullscreen().catch(() => {});
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  showControlsAndAutoHide();
}

function playNextVideo(e) {
  if (e) e.stopPropagation();
  if (!videos.length) return;
  const idx = videos.findIndex(v => String(v.id) === String(currentVideoId));
  const nextVid = videos[(idx + 1) % videos.length];
  if (nextVid) {
    loadVideo(nextVid.id, true);
  }
}

// ==========================================
// SMOOTH CORNER MINI PLAYER (CLICK RETURNS TO TOP)
// ==========================================
function clampAwayFromCenter(left, top, boxW, boxH) {
  const pad = 12;
  const minTop = 64;
  const maxLeft = Math.max(pad, window.innerWidth - boxW - pad);
  const maxTop = Math.max(minTop, window.innerHeight - boxH - 16);

  let clampedLeft = Math.min(Math.max(pad, left), maxLeft);
  let clampedTop = Math.min(Math.max(minTop, top), maxTop);

  const centerX1 = window.innerWidth * 0.25;
  const centerX2 = window.innerWidth * 0.75 - boxW;
  const centerY1 = window.innerHeight * 0.30;
  const centerY2 = window.innerHeight * 0.70 - boxH;

  if (
    centerX2 > centerX1 &&
    clampedLeft > centerX1 &&
    clampedLeft < centerX2 &&
    clampedTop > centerY1 &&
    clampedTop < centerY2
  ) {
    clampedLeft = maxLeft;
    clampedTop = maxTop;
  }

  return { left: clampedLeft, top: clampedTop };
}

function getDefaultBottomRightPos(playerBox) {
  const w = playerBox.offsetWidth || 212;
  const h = playerBox.offsetHeight || 119;
  const rightLeft = Math.max(12, window.innerWidth - w - 12);
  const bottomTop = Math.max(64, window.innerHeight - h - 16);
  return { left: rightLeft, top: bottomTop };
}

function enterFloatingMode() {
  const playerBox = document.getElementById("player-box");
  const dockNotice = document.getElementById("floating-dock-notice");
  const player = document.getElementById("main-video-player");

  if (isFloating || !currentVideoId) return;
  isFloating = true;
  playerBox.classList.add("is-floating");
  dockNotice.classList.remove("hidden");
  hideControlsNow();

  requestAnimationFrame(() => {
    const pos = playerBox.dataset.positioned
      ? clampAwayFromCenter(
          parseFloat(playerBox.style.left) || 0,
          parseFloat(playerBox.style.top) || 0,
          playerBox.offsetWidth || 212,
          playerBox.offsetHeight || 119
        )
      : getDefaultBottomRightPos(playerBox);

    playerBox.style.left = `${pos.left}px`;
    playerBox.style.top = `${pos.top}px`;
  });

  ensureAutoplay(player);
}

function exitFloatingMode() {
  const playerBox = document.getElementById("player-box");
  const dockNotice = document.getElementById("floating-dock-notice");
  const player = document.getElementById("main-video-player");

  isFloating = false;
  manualMiniMode = false;
  playerBox.classList.remove("is-floating", "is-dragging");
  playerBox.style.left = "";
  playerBox.style.top = "";
  dockNotice.classList.add("hidden");
  hideControlsNow();
  ensureAutoplay(player);
}

function returnMiniToTopVideo() {
  ignoreNextScrollDock = true;
  exitFloatingMode();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => {
    ignoreNextScrollDock = false;
    showControlsAndAutoHide(2400);
  }, 550);
}

function toggleMiniModeManual(e) {
  if (e) e.stopPropagation();
  if (isFloating) {
    returnMiniToTopVideo();
  } else {
    manualMiniMode = true;
    enterFloatingMode();
  }
}

function handleScrollSmoothly() {
  if (scrollRafId) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;
    if (!currentVideoId || ignoreNextScrollDock) return;
    const sentinel = document.getElementById("player-sentinel");
    const rect = sentinel.getBoundingClientRect();

    if (rect.bottom < 70) {
      if (!isFloating) {
        enterFloatingMode();
      }
    } else if (!manualMiniMode && isFloating) {
      exitFloatingMode();
    }
  });
}

function setupFloatingMiniPlayer() {
  const playerBox = document.getElementById("player-box");

  window.addEventListener("scroll", handleScrollSmoothly, { passive: true });
  window.addEventListener("resize", () => {
    if (!isFloating) return;
    const pos = clampAwayFromCenter(
      parseFloat(playerBox.style.left) || 0,
      parseFloat(playerBox.style.top) || 0,
      playerBox.offsetWidth || 212,
      playerBox.offsetHeight || 119
    );
    playerBox.style.left = `${pos.left}px`;
    playerBox.style.top = `${pos.top}px`;
  }, { passive: true });

  document.addEventListener("fullscreenchange", () => {
    const player = document.getElementById("main-video-player");
    ensureAutoplay(player);
    showControlsAndAutoHide();
  });

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  function onDragStart(clientX, clientY) {
    if (!isFloating) return;
    dragging = true;
    moved = false;
    startX = clientX;
    startY = clientY;
    const rect = playerBox.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    playerBox.classList.add("is-dragging");
  }

  function onDragMove(clientX, clientY) {
    if (!dragging || !isFloating) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      moved = true;
    }
    const maxLeft = Math.max(12, window.innerWidth - playerBox.offsetWidth - 12);
    const maxTop = Math.max(64, window.innerHeight - playerBox.offsetHeight - 16);
    const nextLeft = Math.min(Math.max(12, origLeft + dx), maxLeft);
    const nextTop = Math.min(Math.max(64, origTop + dy), maxTop);

    playerBox.style.left = `${nextLeft}px`;
    playerBox.style.top = `${nextTop}px`;
    playerBox.dataset.positioned = "1";
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    playerBox.classList.remove("is-dragging");

    if (isFloating && playerBox.dataset.positioned) {
      const snapped = clampAwayFromCenter(
        parseFloat(playerBox.style.left) || 0,
        parseFloat(playerBox.style.top) || 0,
        playerBox.offsetWidth || 212,
        playerBox.offsetHeight || 119
      );
      playerBox.style.left = `${snapped.left}px`;
      playerBox.style.top = `${snapped.top}px`;
    }

    if (moved) {
      setTimeout(() => { moved = false; }, 70);
    }
  }

  playerBox.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    onDragStart(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    onDragMove(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("touchend", onDragEnd);

  playerBox.addEventListener("mousedown", (e) => {
    onDragStart(e.clientX, e.clientY);
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    onDragMove(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", onDragEnd);

  playerBox.addEventListener("click", (e) => {
    if (moved) {
      e.stopPropagation();
      return;
    }
    if (isFloating) {
      e.stopPropagation();
      returnMiniToTopVideo();
      return;
    }
    if (controlsVisible) {
      hideControlsNow();
    } else {
      showControlsAndAutoHide(2400);
    }
  }, true);
}

function scrollToPlayerTop(e) {
  if (e) e.stopPropagation();
  returnMiniToTopVideo();
}

function handlePlayerBoxClick() {
  if (isFloating) {
    returnMiniToTopVideo();
    return;
  }
  if (controlsVisible) {
    hideControlsNow();
  } else {
    showControlsAndAutoHide(2400);
  }
}

function handleControllerBackdropClick(e) {
  if (e.target === e.currentTarget) {
    hideControlsNow();
  }
}

// ==========================================
// BANNER, SOCIAL BAR & POPUNDER HANDLERS
// ==========================================
function injectIframeBanner(containerId, config) {
  return new Promise((resolve) => {
    const container = document.getElementById(containerId);
    if (!container || !config) return resolve();

    container.innerHTML = "";

    window.atOptions = {
      key: config.key,
      format: "iframe",
      height: config.height,
      width: config.width,
      params: {}
    };

    const adScript = document.createElement("script");
    adScript.type = "text/javascript";
    adScript.src = config.src;
    adScript.async = true;

    adScript.onload = () => setTimeout(resolve, 300);
    adScript.onerror = () => setTimeout(resolve, 300);

    container.appendChild(adScript);
  });
}

async function initAdsAfterVideo() {
  await injectIframeBanner("banner-320x50-slot", AD_CONFIG.banner320x50);
  await injectIframeBanner("banner-300x250-slot", AD_CONFIG.banner300x250);
  initSocialBarRandomly();
}

function initSocialBarRandomly() {
  const alreadyShownThisSession = sessionStorage.getItem("vs_social_bar_loaded");
  if (alreadyShownThisSession) return;

  const shouldLoad = Math.random() < 0.6;
  if (!shouldLoad) return;

  const randomDelay = Math.floor(Math.random() * 5000) + 3000;
  setTimeout(() => {
    const holder = document.getElementById("ad-scripts-container");
    if (!holder) return;

    const s = document.createElement("script");
    s.src = AD_CONFIG.socialBarSrc;
    s.setAttribute("data-cfasync", "false");
    s.async = true;
    holder.appendChild(s);

    sessionStorage.setItem("vs_social_bar_loaded", "1");
  }, randomDelay);
}

function handlePopunderOnVideoSwitch() {
  videoSwitchCount += 1;

  if (videoSwitchCount % AD_CONFIG.popunderEverySwitches === 0 && popunderLoadedCount < 2) {
    popunderLoadedCount += 1;
    const holder = document.getElementById("ad-scripts-container");
    if (!holder) return;

    const popScript = document.createElement("script");
    popScript.src = `${AD_CONFIG.popunderSrc}?v=${Date.now()}_${popunderLoadedCount}`;
    popScript.setAttribute("data-cfasync", "false");
    popScript.async = true;
    holder.appendChild(popScript);
  }
}

function createNativeBannerCard(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "col-span-2 native-ad-card flex flex-col items-center justify-center";

  const label = document.createElement("span");
  label.className = "w-full text-left text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 font-semibold";
  label.textContent = "Sponsored";

  const adContainer = document.createElement("div");
  adContainer.id = `native-banner-slot-${index}`;
  adContainer.className = "w-full min-h-[70px] flex items-center justify-center";

  const script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-cfasync", "false");
  script.src = AD_CONFIG.nativeBanner.src;

  wrapper.appendChild(label);
  wrapper.appendChild(adContainer);
  wrapper.appendChild(script);

  return wrapper;
}

// ==========================================
// VIDEO PLAYER, SHARE LINK & UI LOGIC
// ==========================================
function getVideoSource(vid) {
  return (vid && (vid.videoUrl || vid.url)) || "";
}

function updateShareUrlParam(id) {
  if (!id) return;
  const url = new URL(window.location.href);
  url.searchParams.set("v", id);
  window.history.replaceState({}, "", url.toString());
}

function shareCurrentVideo() {
  if (!currentVideoId) return;
  const vid = videos.find(v => v.id === currentVideoId);
  const shareUrl = `${window.location.origin}${window.location.pathname}?v=${encodeURIComponent(currentVideoId)}`;

  if (navigator.share) {
    navigator.share({
      title: vid ? vid.title : "Watch Video",
      url: shareUrl
    }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast("Video share link copied!");
    }).catch(() => {
      showToast(shareUrl);
    });
  } else {
    showToast("Share link ready in address bar");
  }
}

function loadVideo(id, isUserSwitch = false) {
  const player = document.getElementById("main-video-player");
  const placeholder = document.getElementById("empty-player-placeholder");
  const detailsSec = document.getElementById("video-details-section");
  const actionsSec = document.getElementById("video-actions-section");
  const descSec = document.getElementById("video-desc-section");

  const vid = videos.find(v => String(v.id) === String(id)) || videos[0];
  const streamUrl = getVideoSource(vid);

  if (!vid || !streamUrl) {
    currentVideoId = null;
    player.pause();
    player.removeAttribute("src");
    player.load();
    player.classList.add("hidden");
    hideControlsNow();
    placeholder.innerHTML = `
      <p class="text-sm font-bold text-gray-200 mb-1">No Video Available</p>
      <p class="text-xs text-gray-400">Add video links inside <code class="text-gray-200">videos.json</code> on GitHub.</p>
    `;
    placeholder.classList.remove("hidden");
    detailsSec.classList.add("hidden");
    actionsSec.classList.add("hidden");
    descSec.classList.add("hidden");
    renderRecommendations();
    return;
  }

  if (isUserSwitch) {
    handlePopunderOnVideoSwitch();
  }

  currentVideoId = vid.id;
  updateShareUrlParam(vid.id);

  player.classList.remove("hidden");
  placeholder.classList.add("hidden");
  detailsSec.classList.remove("hidden");
  actionsSec.classList.remove("hidden");
  descSec.classList.remove("hidden");
  hideControlsNow();

  player.poster = vid.thumbnail || DEFAULT_THUMB;
  player.src = streamUrl;
  player.playbackRate = SPEEDS[speedIdx];
  player.load();
  ensureAutoplay(player);
  syncPlayPauseIcons();
  updateTimeAndProgress();

  const titleText = vid.title || "Untitled Video";
  document.getElementById("video-title").textContent = titleText;
  document.getElementById("overlay-video-title").textContent = titleText;
  document.getElementById("quality-label").textContent = vid.quality || vid.duration || "720p";
  document.getElementById("channel-name").textContent = vid.creator || "My Channel";
  document.getElementById("channel-subs").textContent = vid.subs || "Creator";
  document.getElementById("channel-avatar").src = vid.thumbnail || DEFAULT_THUMB;
  document.getElementById("video-views").textContent = `${vid.views || "0"} views`;
  document.getElementById("video-date").textContent = vid.date || "";
  document.getElementById("video-description").textContent = vid.description || "";

  const tagsContainer = document.getElementById("video-hashtags");
  tagsContainer.innerHTML = (vid.hashtags || []).map(tag => `<span>${tag}</span>`).join("");

  updateInteractionUI();
  renderRecommendations();
  if (isUserSwitch) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

const mainVideoEl = document.getElementById("main-video-player");
mainVideoEl.addEventListener("loadedmetadata", updateTimeAndProgress);
mainVideoEl.addEventListener("timeupdate", updateTimeAndProgress);
mainVideoEl.addEventListener("play", () => {
  syncPlayPauseIcons();
});
mainVideoEl.addEventListener("pause", () => {
  syncPlayPauseIcons();
});
mainVideoEl.addEventListener("ended", () => {
  playNextVideo(null);
});
mainVideoEl.addEventListener("waiting", () => {
  document.getElementById("video-buffering").classList.remove("hidden");
});
mainVideoEl.addEventListener("canplay", () => {
  document.getElementById("video-buffering").classList.add("hidden");
  if (mainVideoEl.paused && currentVideoId) {
    ensureAutoplay(mainVideoEl);
  }
});
mainVideoEl.addEventListener("playing", () => {
  document.getElementById("video-buffering").classList.add("hidden");
  syncPlayPauseIcons();
});
mainVideoEl.addEventListener("error", () => {
  document.getElementById("video-buffering").classList.add("hidden");
  showToast("Video link could not play");
});

function updateInteractionUI() {
  const vid = videos.find(v => v.id === currentVideoId);
  if (!vid) return;

  const isLiked = !!userState.likes[vid.id];
  const isDisliked = !!userState.dislikes[vid.id];
  const isFav = !!userState.favorites[vid.id];
  const isSub = !!userState.subscriptions[vid.creator];

  const baseLikes = Number(vid.likes) || 0;
  const baseDislikes = Number(vid.dislikes) || 0;

  document.getElementById("like-count").textContent = (baseLikes + (isLiked ? 1 : 0)).toLocaleString();
  document.getElementById("dislike-count").textContent = (baseDislikes + (isDisliked ? 1 : 0)).toLocaleString();

  document.getElementById("like-icon").classList.toggle("fill-brand-red", isLiked);
  document.getElementById("like-icon").classList.toggle("fill-white", !isLiked);

  const favIcon = document.getElementById("fav-icon");
  favIcon.classList.toggle("text-pink-500", isFav);
  favIcon.classList.toggle("text-gray-400", !isFav);

  const subBtn = document.getElementById("subscribe-btn");
  if (isSub) {
    subBtn.textContent = "Subscribed";
    subBtn.className = "px-4 py-1.5 bg-[#252533] text-gray-200 text-xs font-bold rounded-full transition shrink-0";
  } else {
    subBtn.textContent = "Subscribe";
    subBtn.className = "px-4 py-1.5 bg-brand-crimson hover:bg-red-600 text-white text-xs font-bold rounded-full shadow-md shadow-brand-crimson/30 transition shrink-0";
  }
}

function toggleLike() {
  if (!currentVideoId) return;
  userState.likes[currentVideoId] = !userState.likes[currentVideoId];
  if (userState.likes[currentVideoId]) userState.dislikes[currentVideoId] = false;
  saveUserState();
  updateInteractionUI();
}

function toggleDislike() {
  if (!currentVideoId) return;
  userState.dislikes[currentVideoId] = !userState.dislikes[currentVideoId];
  if (userState.dislikes[currentVideoId]) userState.likes[currentVideoId] = false;
  saveUserState();
  updateInteractionUI();
}

function toggleFavorite() {
  if (!currentVideoId) return;
  userState.favorites[currentVideoId] = !userState.favorites[currentVideoId];
  saveUserState();
  updateInteractionUI();
  renderRecommendations();
  showToast(userState.favorites[currentVideoId] ? "Added to Favorites" : "Removed from Favorites");
}

function toggleSubscribe() {
  const vid = videos.find(v => v.id === currentVideoId);
  if (!vid) return;
  userState.subscriptions[vid.creator] = !userState.subscriptions[vid.creator];
  saveUserState();
  updateInteractionUI();
  showToast(userState.subscriptions[vid.creator] ? `Subscribed to ${vid.creator}` : "Unsubscribed");
}

function toggleDescription() {
  const desc = document.getElementById("video-description");
  const label = document.getElementById("desc-toggle-label");
  const isClamped = desc.classList.contains("line-clamp-2");
  desc.classList.toggle("line-clamp-2", !isClamped);
  label.textContent = isClamped ? "Show less" : "More";
}

function renderRecommendations() {
  const list = document.getElementById("recommendations-list");
  const filtered = videos.filter(v => {
    const matchesCat = activeCategory === "All" || v.category === activeCategory;
    const matchesFeed =
      activeFeedFilter === "all" ||
      (activeFeedFilter === "favorites" && userState.favorites[v.id]);
    const matchesSearch =
      !searchQuery ||
      (v.title || "").toLowerCase().includes(searchQuery) ||
      (v.creator || "").toLowerCase().includes(searchQuery) ||
      (v.hashtags || []).some(t => t.toLowerCase().includes(searchQuery));
    return matchesCat && matchesFeed && matchesSearch;
  });

  document.getElementById("queue-count").textContent = `${filtered.length} Video${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="col-span-2 text-center py-8 text-xs text-gray-400 bg-[#13131A] rounded-xl border border-brand-cardBorder/60">No videos found in videos.json.</div>`;
    return;
  }

  list.innerHTML = "";
  let nativeCount = 0;

  filtered.forEach((v, idx) => {
    const isPlaying = v.id === currentVideoId;
    const article = document.createElement("article");
    article.onclick = () => loadVideo(v.id, true);
    article.className = `flex flex-col bg-[#13131A] p-2 rounded-xl border ${isPlaying ? "border-brand-red" : "border-brand-cardBorder/60"} hover:border-brand-red/50 transition cursor-pointer`;

    article.innerHTML = `
      <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-800 mb-2">
        <img alt="${v.title}" class="w-full h-full object-cover" src="${v.thumbnail || DEFAULT_THUMB}" />
        ${isPlaying ? '<span class="absolute top-1 left-1 bg-brand-red text-white font-bold text-[9px] px-1.5 py-0.5 rounded">PLAYING</span>' : '<span class="absolute top-1 left-1 bg-black/75 text-white font-bold text-[9px] px-1 rounded">VIDEO</span>'}
        <span class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 rounded">${v.duration || "HD"}</span>
      </div>
      <div class="flex flex-col justify-between min-w-0 flex-1">
        <div>
          <h3 class="text-xs font-semibold text-white leading-tight line-clamp-2">${v.title}</h3>
          <p class="text-[11px] text-gray-400 mt-1 truncate">${v.creator || "My Channel"}</p>
        </div>
        <span class="text-[10px] text-gray-500 mt-1.5 truncate">${v.views || "0"} views • ${v.date || ""}</span>
      </div>
    `;

    list.appendChild(article);

    if ((idx + 1) % AD_CONFIG.nativeBanner.everyVideos === 0) {
      nativeCount += 1;
      list.appendChild(createNativeBannerCard(nativeCount));
    }
  });
}

function filterByCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll(".cat-chip").forEach(btn => {
    if (btn.dataset.cat === cat) {
      btn.className = "cat-chip px-3.5 py-1.5 rounded-full bg-white text-black font-semibold whitespace-nowrap transition";
    } else {
      btn.className = "cat-chip px-3 py-1.5 rounded-full bg-[#1C1C24] text-gray-300 whitespace-nowrap border border-brand-cardBorder transition";
    }
  });
  renderRecommendations();
}

function setFeedFilter(filter) {
  activeFeedFilter = filter;
  document.querySelectorAll(".feed-pill").forEach(btn => {
    if (btn.dataset.feed === filter) {
      btn.className = "feed-pill px-3 py-1 rounded-full bg-white text-black font-semibold whitespace-nowrap";
    } else {
      btn.className = "feed-pill px-3 py-1 rounded-full bg-[#1A1A24] text-gray-300 border border-brand-cardBorder whitespace-nowrap";
    }
  });
  renderRecommendations();
}

function toggleSearch() {
  const bar = document.getElementById("search-bar-wrapper");
  bar.classList.toggle("hidden");
  if (!bar.classList.contains("hidden")) {
    document.getElementById("search-input").focus();
  }
}

function handleSearch(val) {
  searchQuery = val.trim().toLowerCase();
  renderRecommendations();
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  searchQuery = "";
  document.getElementById("search-bar-wrapper").classList.add("hidden");
  renderRecommendations();
}

function resetFilters() {
  filterByCategory("All");
  setFeedFilter("all");
  clearSearch();
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

// ==========================================
// PRIORITY INIT: LOAD VIDEO FIRST, ADS AFTER
// ==========================================
async function initVideos() {
  setupFloatingMiniPlayer();

  try {
    const res = await fetch("./videos.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    videos = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to load videos.json:", err);
    videos = [];
    showToast("Could not load videos.json");
  }

  const params = new URLSearchParams(window.location.search);
  const sharedId = params.get("v");
  const initialId = sharedId || (videos.length > 0 ? videos[0].id : null);

  loadVideo(initialId, false);

  setTimeout(() => {
    initAdsAfterVideo();
  }, 600);
}

initVideos();