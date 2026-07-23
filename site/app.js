const REPO = 'HyperlinksSpace/BoysChanger';

async function loadRelease() {
  const meta = document.getElementById('release-meta');
  const list = document.getElementById('asset-list');
  const dlWin = document.getElementById('dl-windows');
  const dlMac = document.getElementById('dl-mac');

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tag = data.tag_name || 'latest';
    const published = data.published_at
      ? new Date(data.published_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';
    meta.textContent = `Latest release ${tag}${published ? ` · ${published}` : ''}`;

    const assets = Array.isArray(data.assets) ? data.assets : [];
    if (!assets.length) {
      list.innerHTML =
        '<li>No binary assets yet. Push to main to trigger the release workflow.</li>';
      return;
    }

    const win = assets.find((a) => /windows|\.exe$/i.test(a.name) && !/blockmap/i.test(a.name));
    const mac =
      assets.find((a) => /macos|darwin|\.dmg$/i.test(a.name)) ||
      assets.find((a) => /\.zip$/i.test(a.name) && /mac|darwin|arm64|x64/i.test(a.name));

    if (win) dlWin.href = win.browser_download_url;
    if (mac) dlMac.href = mac.browser_download_url;

    list.innerHTML = assets
      .filter((a) => !/blockmap|\.yml$|\.yaml$/i.test(a.name))
      .map((a) => {
        const mb = (a.size / (1024 * 1024)).toFixed(1);
        return `<li><a href="${a.browser_download_url}"><span>${a.name}</span><span>${mb} MB</span></a></li>`;
      })
      .join('');
  } catch (err) {
    meta.textContent = 'Latest release unavailable yet — check GitHub Releases after the first push.';
    list.innerHTML = `<li><a href="https://github.com/${REPO}/releases">Open releases on GitHub</a></li>`;
    console.warn(err);
  }
}

loadRelease();
