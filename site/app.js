/* Site i18n: EN / 中文 / Русский — inherit system language on first visit */
(function () {
  const REPO = 'HyperlinksSpace/BoysChanger';

  const dict = {
    en: {
      navFeatures: 'Features',
      navSetup: 'Setup',
      navDownload: 'Download',
      navGithub: 'GitHub',
      eyebrow: 'Windows & macOS · Free Voice Studio · HyperlinksSpace',
      lede: 'A cute full-screen voice studio: colorful built-in voices, local Voice Studio saves, soundboard, system tray status, and system-wide routing — free, no Pro paywall.',
      dlWin: 'Download for Windows',
      dlMac: 'Download for macOS',
      loading: 'Loading latest release…',
      featuresTitle: 'Cute like Voicemod. Free like open source.',
      featuresLede: 'Full-screen library, free Voice Studio, tray icon that turns red when you’re off.',
      f1t: 'Colorful voice library',
      f1d: 'Built-in characters plus voices you save locally in Studio.',
      f2t: 'Voice Studio — always free',
      f2d: 'Race, gender, age, timbre, FX — craft and keep voices on your device.',
      f3t: 'Soundboard + prehear',
      f3d: 'Upload MP3s and replay the last 11 seconds before you go live.',
      f4t: 'Tray stays with you',
      f4d: 'System tray icon stays after close; green when ON, red when OFF.',
      setupTitle: 'Quick setup',
      winTitle: 'Windows',
      macTitle: 'macOS',
      assetsTitle: 'Latest assets',
      note: 'Every push to main builds Windows and macOS installers and publishes a new GitHub Release automatically. The app checks Releases for updates.',
      footerMit: 'BoysChanger · MIT',
      footerSrc: 'Source on GitHub',
      language: 'Language',
      noAssets: 'No binary assets yet. Push to main to trigger the release workflow.',
      releaseMeta: 'Latest release {tag}{date}',
      releaseUnavailable: 'Latest release unavailable yet — check GitHub Releases after the first push.',
      openReleases: 'Open releases on GitHub',
    },
    zh: {
      navFeatures: '功能',
      navSetup: '安装',
      navDownload: '下载',
      navGithub: 'GitHub',
      eyebrow: 'Windows 与 macOS · 免费音色工作室 · HyperlinksSpace',
      lede: '可爱的全屏变声工作室：彩色内置音色、本地保存、音效板、托盘状态与系统级路由 — 完全免费，无 Pro 墙。',
      dlWin: '下载 Windows 版',
      dlMac: '下载 macOS 版',
      loading: '正在加载最新版本…',
      featuresTitle: '像 Voicemod 一样好看，像开源一样免费',
      featuresLede: '全屏音色库、永久免费工作室、关闭时托盘图标变红。',
      f1t: '彩色音色库',
      f1d: '内置角色，加上你在工作室本地保存的音色。',
      f2t: '音色工作室 — 永久免费',
      f2d: '种族、性别、年龄、音色与特效 — 在本机创建并保存。',
      f3t: '音效板 + 试听',
      f3d: '上传 MP3，上线前试听最近 11 秒。',
      f4t: '托盘常驻',
      f4d: '关闭窗口后托盘仍在；开启绿色，关闭红色。',
      setupTitle: '快速安装',
      winTitle: 'Windows',
      macTitle: 'macOS',
      assetsTitle: '最新资源',
      note: '每次推送到 main 都会自动构建并发布。应用会从 GitHub Releases 检查更新。',
      footerMit: 'BoysChanger · MIT',
      footerSrc: 'GitHub 源码',
      language: '语言',
      noAssets: '尚无安装包。推送到 main 以触发发布流程。',
      releaseMeta: '最新版本 {tag}{date}',
      releaseUnavailable: '尚无发布 — 首次推送后请查看 GitHub Releases。',
      openReleases: '打开 GitHub Releases',
    },
    ru: {
      navFeatures: 'Возможности',
      navSetup: 'Установка',
      navDownload: 'Скачать',
      navGithub: 'GitHub',
      eyebrow: 'Windows и macOS · Бесплатная студия · HyperlinksSpace',
      lede: 'Милая полноэкранная студия: цветные голоса, локальные сохранения, саундборд, иконка в трее и системный микрофон — бесплатно, без Pro.',
      dlWin: 'Скачать для Windows',
      dlMac: 'Скачать для macOS',
      loading: 'Загрузка последнего релиза…',
      featuresTitle: 'Красиво как Voicemod. Бесплатно как open source.',
      featuresLede: 'Полноэкранная библиотека, бесплатная студия, красная иконка в трее когда выкл.',
      f1t: 'Цветная библиотека',
      f1d: 'Встроенные персонажи плюс голоса, сохранённые локально в Студии.',
      f2t: 'Студия — всегда бесплатно',
      f2d: 'Раса, пол, возраст, тембр, FX — создавайте и храните на устройстве.',
      f3t: 'Саундборд + prehear',
      f3d: 'Загружайте MP3 и слушайте последние 11 секунд перед эфиром.',
      f4t: 'Трей всегда с вами',
      f4d: 'Иконка остаётся после закрытия; зелёная при ON, красная при OFF.',
      setupTitle: 'Быстрый старт',
      winTitle: 'Windows',
      macTitle: 'macOS',
      assetsTitle: 'Файлы релиза',
      note: 'Каждый push в main собирает установщики и публикует Release. Приложение само проверяет обновления.',
      footerMit: 'BoysChanger · MIT',
      footerSrc: 'Исходники на GitHub',
      language: 'Язык',
      noAssets: 'Бинарников пока нет. Сделайте push в main для релиза.',
      releaseMeta: 'Последний релиз {tag}{date}',
      releaseUnavailable: 'Релиз пока недоступен — смотрите GitHub Releases после первого push.',
      openReleases: 'Открыть релизы на GitHub',
    },
  };

  function detect() {
    const saved = localStorage.getItem('boyschanger-site-locale');
    if (saved && dict[saved]) return saved;
    const lang = (navigator.language || 'en').toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('ru')) return 'ru';
    return 'en';
  }

  let locale = detect();

  function apply() {
    const d = dict[locale] || dict.en;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key && d[key] != null) el.textContent = d[key];
    });
    const sel = document.getElementById('lang-select');
    if (sel) sel.value = locale;
    localStorage.setItem('boyschanger-site-locale', locale);
  }

  async function loadRelease() {
    const meta = document.getElementById('release-meta');
    const list = document.getElementById('asset-list');
    const dlWin = document.getElementById('dl-windows');
    const dlMac = document.getElementById('dl-mac');
    const d = dict[locale] || dict.en;

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tag = data.tag_name || 'latest';
      const published = data.published_at
        ? ' · ' +
          new Date(data.published_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '';
      meta.textContent = d.releaseMeta.replace('{tag}', tag).replace('{date}', published);

      const assets = Array.isArray(data.assets) ? data.assets : [];
      if (!assets.length) {
        list.innerHTML = `<li>${d.noAssets}</li>`;
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
      meta.textContent = d.releaseUnavailable;
      list.innerHTML = `<li><a href="https://github.com/${REPO}/releases">${d.openReleases}</a></li>`;
      console.warn(err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('lang-select');
    if (sel) {
      sel.addEventListener('change', () => {
        locale = sel.value;
        apply();
        loadRelease();
      });
    }
    apply();
    loadRelease();
  });
})();
