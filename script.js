document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const header = document.getElementById("header");
  const inputSection = document.getElementById("input-section");
  const streamBtn = document.getElementById("streamBtn");
  const torrentIdInput = document.getElementById("torrentId");
  const uploadBtn = document.getElementById("uploadBtn");
  const torrentFileInput =
    document.getElementById("torrentFileInput");
  const videoPlayer = document.getElementById("videoPlayer");
  const playerContainer =
    document.getElementById("player-container");
  const logsContainer = document.getElementById("logs");

  let client = null; // To hold the WebTorrent client instance

  // --- Control State Functions ---
  function disableControls() {
    streamBtn.disabled = true;
    streamBtn.textContent = "Connecting...";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Connecting...";
  }

  function enableControlsForNewStream() {
    streamBtn.disabled = false;
    streamBtn.textContent = "Stream New Video";
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Select New .torrent";
  }

  function enableControlsForFailure() {
    streamBtn.disabled = false;
    streamBtn.textContent = "Stream Video";
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Select .torrent File";
  }

  // --- Helper Functions ---
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) +
      " " +
      sizes[i]
    );
  }

  function log(message) {
    const p = document.createElement("p");
    p.innerHTML = message;
    if (
      logsContainer.firstChild &&
      logsContainer.firstChild.textContent.includes(
        "Awaiting",
      )
    ) {
      logsContainer.innerHTML = "";
    }
    logsContainer.prepend(p);
  }

  // --- Core Logic ---
  function startStreaming(torrentSource) {
    if (!torrentSource) {
      log(
        '<span class="text-red-400">Error: Please provide a magnet link or select a file.</span>',
      );
      return;
    }
    disableControls();
    logsContainer.classList.remove("hidden");
    logsContainer.innerHTML =
      '<p class="text-yellow-400">Initializing WebTorrent client...</p>';

    if (client) {
      client.destroy(() => {
        client = createAndStartClient(torrentSource);
      });
    } else {
      client = createAndStartClient(torrentSource);
    }
  }

  // Event listener for magnet link button
  streamBtn.addEventListener("click", () => {
    const torrentId = torrentIdInput.value.trim();
    startStreaming(torrentId);
  });

  // Event listener for file upload button
  uploadBtn.addEventListener("click", () => {
    torrentFileInput.click();
  });

  // Event listener for file selection
  torrentFileInput.addEventListener("change", () => {
    if (torrentFileInput.files.length > 0) {
      const file = torrentFileInput.files[0];
      startStreaming(file);
    }
  });

  function createAndStartClient(torrentSource) {
    // FIX: Initialize client with public trackers for better peer discovery
    const newClient = new WebTorrent({
      tracker: {
        ws: [
          "wss://tracker.webtorrent.io",
          "wss://tracker.openwebtorrent.com",
          "wss://tracker.btorrent.xyz",
        ],
      },
    });

    newClient.on("error", (err) => {
      console.error("WebTorrent Client Error:", err);
      log(
        `<span class="text-red-400">Client Error: ${err.message}</span>`,
      );
      enableControlsForFailure();
    });

    log(
      '<span class="text-blue-400">Adding torrent...</span> Please wait, this can take a moment.',
    );

    newClient.add(torrentSource, (torrent) => {
      log(
        `<span class="text-green-400">Successfully added torrent:</span> ${torrent.name}`,
      );
      log(`Fetching metadata and connecting to peers...`);

      const file = torrent.files.reduce(
        (a, b) => {
          const isAVideo =
            b.name.endsWith(".mp4") ||
            b.name.endsWith(".mkv") ||
            b.name.endsWith(".webm");
          if (isAVideo && b.length > a.length) {
            return b;
          }
          return a;
        },
        { length: -1 },
      );

      if (file.length === -1) {
        log(
          '<span class="text-red-400">Error: No video files (.mp4, .mkv, .webm) found.</span>',
        );
        enableControlsForFailure();
        return;
      }

      log(
        `Found video file: <span class="font-bold">${file.name}</span> (${formatBytes(file.length)})`,
      );
      playerContainer.classList.remove("hidden");

      file.renderTo(videoPlayer, {
        autoplay: true,
        muted: false,
      });

      videoPlayer.addEventListener("canplay", () => {
        log(
          '<span class="text-green-500">Video is ready to play!</span>',
        );
        header.style.display = "none";
        inputSection.style.display = "none";
      });

      torrent.on("download", (bytes) => {
        const progress = (torrent.progress * 100).toFixed(
          2,
        );
        const statusMessage = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <span>Progress: <strong class="text-white">${progress}%</strong></span>
                    <span>Peers: <strong class="text-white">${torrent.numPeers}</strong></span>
                    <span>Speed: <strong class="text-white">${formatBytes(torrent.downloadSpeed)}/s</strong></span>
                    <span>Data: <strong class="text-white">${formatBytes(torrent.downloaded)}</strong></span>
                </div>`;
        const firstLog = logsContainer.firstChild;
        if (firstLog && firstLog.id === "progress-log") {
          firstLog.innerHTML = statusMessage;
        } else {
          const p = document.createElement("p");
          p.id = "progress-log";
          p.innerHTML = statusMessage;
          logsContainer.prepend(p);
        }
      });

      torrent.on("done", () => {
        log(
          '<span class="text-green-400 font-bold">Download complete!</span>',
        );
      });

      torrent.on("error", (err) => {
        log(
          `<span class="text-red-400">Torrent Error: ${err.message}</span>`,
        );
      });

      enableControlsForNewStream();
    });

    return newClient;
  }
});
