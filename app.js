const DEFAULT_THUMB = "https://lh3.googleusercontent.com/aida-public/AB6AXuCYU1tgUo1HVlvVKqbjPyvMdEu1QeD-0DJgdlc_NZizO1MMTT4Au1CbMtcXze7xApFcL3m9n1NnHv1svw-LtrEfXD1RNN9gZO6gwlAkYL9A_byetE3dg6nLfwDdxug6S8ZL0gTFh8XUE3l1phEQNTJ3HMvh33wfsKnlOKBiUK-VRA8ZZKbG8UQKhggHEEWEGjUDuldumQAHrftHBlmsLNzSPKOvdKoaU7YOKPR0QWGNzGXb4i0yUsUR";

// ==========================================
// AD CONFIGURATION
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

let videos = [];
let currentVideoId = null;
let activeCategory = "All";
let activeFeedFilter = "all";
let searchQuery = "";
let videoSwitchCount = 0;
let popunderLoadedCount = 0;

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
    adScript.async = false;

    adScript.onload = () => setTimeout(resolve, 400);
    adScript.onerror = () => setTimeout(resolve, 400);

    container.appendChild(adScript);
  });
}

async function initBanners() {
  await injectIframeBanner("banner-320x50-slot", AD_CONFIG.banner320x50);
  await injectIframeBanner("banner-300x250-slot", AD_CONFIG.banner300x250);
}

// Social Bar: randomly o porimito-bhabe load hobe (UX nosto na korar jonno)
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

// Popunder: proti 4ti video switch korle ekbar trigger hobe
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

// Native Banner: proti 4ti video-r porpor render hobe
function createNativeBannerCard(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "native-ad-card flex flex-col items-center justify-center";

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
// VIDEO PLAYER & UI LOGIC
// ==========================================
function loadVideo(id, isUserSwitch = false) {
  const player = document.getElementById("main-embed-player");
  const placeholder = document.getElementById("empty-player-placeholder");
  const detailsSec = document.getElementById("video-details-section");
  const actionsSec = document.getElementById("video-actions-section");
  const descSec = document.getElementById("video-desc-section");

  const vid = videos.find(v => v.id === id) || videos[0];

  if (!vid || !vid.embedUrl) {
    currentVideoId = null;
    player.src = "";
    player.classList.add("hidden");
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
  player.classList.remove("hidden");
  placeholder.classList.add("hidden");
  detailsSec.classList.remove("hidden");
  actionsSec.classList.remove("hidden");
  descSec.classList.remove("hidden");

  player.src = vid.embedUrl;
  document.getElementById("video-title").textContent = vid.title || "Untitled Video";
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
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
    subBtn.className = "px-4 py-1.5 bg-[#252533] text-gray-200 text-xs font-bold rounded-full transition";
  } else {
    subBtn.textContent = "Subscribe";
    subBtn.className = "px-4 py-1.5 bg-brand-crimson hover:bg-red-600 text-white text-xs font-bold rounded-full shadow-md shadow-brand-crimson/30 transition";
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
    list.innerHTML = `<div class="text-center py-8 text-xs text-gray-400 bg-[#13131A] rounded-xl border border-brand-cardBorder/60">No videos found in videos.json.</div>`;
    return;
  }

  list.innerHTML = "";
  let nativeCount = 0;

  filtered.forEach((v, idx) => {
    const isPlaying = v.id === currentVideoId;
    const article = document.createElement("article");
    article.onclick = () => loadVideo(v.id, true);
    article.className = `flex space-x-3 bg-[#13131A] p-2 rounded-xl border ${isPlaying ? "border-brand-red" : "border-brand-cardBorder/60"} hover:border-brand-red/50 transition cursor-pointer`;

    article.innerHTML = `
      <div class="relative w-36 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
        <img alt="${v.title}" class="w-full h-full object-cover" src="${v.thumbnail || DEFAULT_THUMB}" />
        ${isPlaying ? '<span class="absolute top-1 left-1 bg-brand-red text-white font-bold text-[9px] px-1.5 py-0.5 rounded">PLAYING</span>' : '<span class="absolute top-1 left-1 bg-black/75 text-white font-bold text-[9px] px-1 rounded">EMBED</span>'}
        <span class="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1 rounded">${v.duration || "HD"}</span>
      </div>
      <div class="flex flex-col justify-between py-0.5 min-w-0 flex-1">
        <div>
          <h3 class="text-xs font-semibold text-white leading-tight line-clamp-2">${v.title}</h3>
          <p class="text-[11px] text-gray-400 mt-1 flex items-center">${v.creator || "My Channel"}</p>
        </div>
        <span class="text-[10px] text-gray-500">${v.views || "0"} views • ${v.date || ""}</span>
      </div>
    `;

    list.appendChild(article);

    // Proti 4ti video-r porpor Native Banner jukto kora (4, 8, 12...)
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

async function initVideos() {
  await initBanners();
  initSocialBarRandomly();

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

  currentVideoId = videos.length > 0 ? videos[0].id : null;
  loadVideo(currentVideoId, false);
}

initVideos();
