/* Site i18n: EN / 中文 / Русский — inherit system language on first visit */
(function () {
  const REPO = 'HyperlinksSpace/BoysChanger';

  const dict = {
    en: {
      navFeatures: 'Features',
      navSetup: 'Setup',
      navDownload: 'Download',
      navGithub: 'GitHub',
      eyebrow: 'Windows & macOS · Open source · HyperlinksSpace',
      lede: 'Turn your microphone into a character. Shape race, gender, age, and timbre, stack effects, prehear the last 11 seconds, then push the result system-wide.',
      dlWin: 'Download for Windows',
      dlMac: 'Download for macOS',
      loading: 'Loading latest release…',
      featuresTitle: 'Built for live voice',
      featuresLede: 'One engine, many characters — toggled with a single ON/OFF control.',
      f1t: 'Character stack',
      f1d: 'Race, gender, age, timbre, amplifier, and volume.',
      f2t: 'Layered effects',
      f2d: 'Echo, wah-wah, distortion, reverb, chorus, robot, flanger, bitcrush — all at once.',
      f3t: '11s prehear',
      f3d: 'Replay the last eleven seconds of processed voice before you go live.',
      f4t: 'System-wide input',
      f4d: 'Route through a virtual cable and set it as the OS microphone.',
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
      eyebrow: 'Windows 与 macOS · 开源 · HyperlinksSpace',
      lede: '把麦克风变成角色。调节种族、性别、年龄与音色，叠加效果，试听最近 11 秒，并设为系统麦克风。',
      dlWin: '下载 Windows 版',
      dlMac: '下载 macOS 版',
      loading: '正在加载最新版本…',
      featuresTitle: '为实时变声而设计',
      featuresLede: '一套引擎，多种角色 — 一键开关。',
      f1t: '角色参数',
      f1d: '种族、性别、年龄、音色、增益与音量。',
      f2t: '叠加效果',
      f2d: '回声、哇音、失真、混响、合唱、机器人、镶边、位粉碎 — 可同时开启。',
      f3t: '11 秒试听',
      f3d: '上线前回放最近十一秒处理后的声音。',
      f4t: '系统级输入',
      f4d: '经虚拟声卡路由，并设为系统麦克风。',
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
      eyebrow: 'Windows и macOS · Open source · HyperlinksSpace',
      lede: 'Превратите микрофон в персонажа. Настройте расу, пол, возраст и тембр, наложите эффекты, прослушайте последние 11 секунд и сделайте результат системным микрофоном.',
      dlWin: 'Скачать для Windows',
      dlMac: 'Скачать для macOS',
      loading: 'Загрузка последнего релиза…',
      featuresTitle: 'Для живого голоса',
      featuresLede: 'Один движок, много персонажей — одним переключателем ON/OFF.',
      f1t: 'Характер',
      f1d: 'Раса, пол, возраст, тембр, усиление и громкость.',
      f2t: 'Слои эффектов',
      f2d: 'Эхо, вау-вау, дисторшн, реверб, хорус, робот, фленжер, биткраш — всё сразу.',
      f3t: 'Прослушивание 11 с',
      f3d: 'Повторите последние одиннадцать секунд до эфира.',
      f4t: 'Системный вход',
      f4d: 'Маршрутизация через виртуальный кабель как микрофон ОС.',
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
