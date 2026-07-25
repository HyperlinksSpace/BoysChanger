/* Site i18n: EN / 中文 / Русский — inherit system language on first visit */
(function () {
  const REPO = 'HyperlinksSpace/BoysChanger';

  const dict = {
    en: {
      navFeatures: 'Features',
      navHow: 'How it works',
      navSetup: 'Setup',
      navDownload: 'Download',
      navGithub: 'GitHub',
      eyebrow: 'Hyperlinks Space · Windows & macOS',
      lede: 'Real-time voice changer & soundboard. Shape who you sound like, drop memes into chat, and route the result system-wide — with Voice Studio on your device.',
      dlWin: 'Download for Windows',
      dlMac: 'Download for macOS',
      worksWhere: 'Works with Telegram, Discord, games, and anything that can pick a microphone.',
      loading: 'Loading latest release…',
      featuresTitle: 'Change your voice. Become anyone.',
      featuresLede:
        'Gaming, streaming, or vibing with friends — built-in voices, local Studio saves, and a soundboard that hits the same cable as your mic.',
      f1t: 'Colorful voice library',
      f1d: 'Built-in characters plus voices you craft and keep on this device. Cloud sync comes next.',
      f2t: 'Voice Studio',
      f2d: 'Race, gender, age, timbre, and stacked FX — craft voices locally in Studio.',
      f3t: 'Soundboard + 11s prehear',
      f3d: 'Upload MP3s, replay the last eleven seconds, and send both to speakers and the virtual cable.',
      f4t: 'Tray that stays with you',
      f4d: 'Close the window — the tray remains. Green when the changer is ON, red when it’s OFF.',
      howTitle: 'How does BoysChanger work?',
      how1t: 'Supercharge your mic path',
      how1d: 'Install the bundled virtual cable (Windows) or BlackHole (macOS). BoysChanger writes processed audio into it.',
      how2t: 'Point apps at the cable',
      how2d: 'In Telegram / Discord / games, set the microphone to CABLE Output or BlackHole — not your hardware mic.',
      how3t: 'Blow minds',
      how3d: 'Pick a voice, flip ON, drop sounds. The tray icon tells your squad (and you) when you’re live.',
      setupTitle: 'Quick setup',
      winTitle: 'Windows',
      macTitle: 'macOS',
      win1: 'Install BoysChanger → use Install virtual cable (bundled VB-CABLE), reboot if asked.',
      win2: 'Input = real mic · Output = CABLE Input.',
      win3: 'Click Setup for Telegram (or Apply as system input).',
      win4: 'In Telegram: Call settings → Microphone = CABLE Output. Rejoin the chat.',
      mac1: 'Install BlackHole 2ch, then BoysChanger.',
      mac2: 'Input = real mic · Output = BlackHole 2ch.',
      mac3: 'Apply as system input (or set Sound → Input to BlackHole).',
      mac4: 'In Telegram: Call settings → Microphone = BlackHole. Rejoin the chat.',
      assetsTitle: 'Latest release assets',
      note: 'Every push to main builds Windows and macOS installers and publishes a GitHub Release. The app checks Releases for updates.',
      footerMit: 'BoysChanger · MIT · Hyperlinks Space',
      footerHs: 'Hyperlinks Space Program',
      footerSrc: 'Source on GitHub',
      language: 'Language',
      noAssets: 'No binary assets yet. Push to main to trigger the release workflow.',
      releaseMeta: 'Latest release {tag}{date}',
      releaseUnavailable: 'Latest release unavailable yet — check GitHub Releases after the first push.',
      openReleases: 'Open releases on GitHub',
    },
    zh: {
      navFeatures: '功能',
      navHow: '原理',
      navSetup: '安装',
      navDownload: '下载',
      navGithub: 'GitHub',
      eyebrow: 'Hyperlinks Space · Windows 与 macOS',
      lede: '实时变声与音效板。塑造你的声音，把梗声丢进聊天，并做系统级路由 — 在本机使用音色工作室。',
      dlWin: '下载 Windows 版',
      dlMac: '下载 macOS 版',
      worksWhere: '适用于 Telegram、Discord、游戏，以及任何可选择麦克风的应用。',
      loading: '正在加载最新版本…',
      featuresTitle: '改变声音。成为任何人。',
      featuresLede: '游戏、直播或和朋友开黑 — 内置音色、本地工作室保存，音效板与麦克风走同一条虚拟线。',
      f1t: '彩色音色库',
      f1d: '内置角色，加上你在本机创建并保存的音色。云同步即将到来。',
      f2t: '音色工作室',
      f2d: '种族、性别、年龄、音色与叠加特效 — 在工作室本地打造音色。',
      f3t: '音效板 + 11 秒试听',
      f3d: '上传 MP3，回放最近十一秒，同时送到扬声器与虚拟声卡。',
      f4t: '托盘常驻',
      f4d: '关闭窗口后托盘仍在。开启绿色，关闭红色。',
      howTitle: 'BoysChanger 如何工作？',
      how1t: '强化麦克风通路',
      how1d: '安装捆绑虚拟声卡（Windows）或 BlackHole（macOS）。BoysChanger 把处理后的音频写入其中。',
      how2t: '让应用指向声卡',
      how2d: '在 Telegram / Discord / 游戏中，把麦克风设为 CABLE Output 或 BlackHole — 不要选硬件麦。',
      how3t: '开麦惊艳全场',
      how3d: '选音色、打开 ON、丢音效。托盘图标告诉你（和队友）何时在线。',
      setupTitle: '快速安装',
      winTitle: 'Windows',
      macTitle: 'macOS',
      win1: '安装 BoysChanger → 使用「安装虚拟声卡」（捆绑 VB-CABLE），按提示重启。',
      win2: '输入 = 真实麦克风 · 输出 = CABLE Input。',
      win3: '点击「为 Telegram 设置」（或「应用为系统输入」）。',
      win4: 'Telegram：通话设置 → 麦克风 = CABLE Output。重新加入通话。',
      mac1: '安装 BlackHole 2ch，再安装 BoysChanger。',
      mac2: '输入 = 真实麦克风 · 输出 = BlackHole 2ch。',
      mac3: '应用为系统输入（或在声音设置中将输入设为 BlackHole）。',
      mac4: 'Telegram：通话设置 → 麦克风 = BlackHole。重新加入通话。',
      assetsTitle: '最新发布资源',
      note: '每次推送到 main 都会构建并发布。应用会从 GitHub Releases 检查更新。',
      footerMit: 'BoysChanger · MIT · Hyperlinks Space',
      footerHs: 'Hyperlinks Space Program',
      footerSrc: 'GitHub 源码',
      language: '语言',
      noAssets: '尚无安装包。推送到 main 以触发发布流程。',
      releaseMeta: '最新版本 {tag}{date}',
      releaseUnavailable: '尚无发布 — 首次推送后请查看 GitHub Releases。',
      openReleases: '打开 GitHub Releases',
    },
    ru: {
      navFeatures: 'Возможности',
      navHow: 'Как работает',
      navSetup: 'Установка',
      navDownload: 'Скачать',
      navGithub: 'GitHub',
      eyebrow: 'Hyperlinks Space · Windows и macOS',
      lede: 'Голосовой чейнджер и саундборд в реальном времени. Меняйте голос, кидайте мемы в чат и выводите результат системно — Voice Studio на вашем устройстве.',
      dlWin: 'Скачать для Windows',
      dlMac: 'Скачать для macOS',
      worksWhere: 'Работает с Telegram, Discord, играми и любым приложением с выбором микрофона.',
      loading: 'Загрузка последнего релиза…',
      featuresTitle: 'Меняйте голос. Станьте кем угодно.',
      featuresLede:
        'Игры, стримы или друзья — встроенные голоса, локальные сохранения Студии и саундборд в тот же кабель, что и микрофон.',
      f1t: 'Цветная библиотека',
      f1d: 'Встроенные персонажи плюс голоса, созданные и сохранённые на устройстве. Облако — следом.',
      f2t: 'Голосовая студия',
      f2d: 'Раса, пол, возраст, тембр и слои FX — создавайте голоса локально в Студии.',
      f3t: 'Саундборд + 11 с prehear',
      f3d: 'Загружайте MP3, повторяйте последние одиннадцать секунд — в динамики и в виртуальный кабель.',
      f4t: 'Трей всегда с вами',
      f4d: 'Закройте окно — трей останется. Зелёный при ON, красный при OFF.',
      howTitle: 'Как работает BoysChanger?',
      how1t: 'Усильте путь микрофона',
      how1d: 'Установите встроенный виртуальный кабель (Windows) или BlackHole (macOS). BoysChanger пишет в него обработанный звук.',
      how2t: 'Направьте приложения на кабель',
      how2d: 'В Telegram / Discord / играх выберите микрофон CABLE Output или BlackHole — не аппаратный.',
      how3t: 'Взорвите чат',
      how3d: 'Выберите голос, включите ON, кидайте звуки. Иконка в трее показывает, когда вы в эфире.',
      setupTitle: 'Быстрый старт',
      winTitle: 'Windows',
      macTitle: 'macOS',
      win1: 'Установите BoysChanger → Install virtual cable (VB-CABLE), перезагрузитесь по запросу.',
      win2: 'Вход = реальный мик · Выход = CABLE Input.',
      win3: 'Нажмите Setup for Telegram (или Apply as system input).',
      win4: 'В Telegram: Call settings → Microphone = CABLE Output. Перезайдите в чат.',
      mac1: 'Установите BlackHole 2ch, затем BoysChanger.',
      mac2: 'Вход = реальный мик · Выход = BlackHole 2ch.',
      mac3: 'Apply as system input (или Sound → Input = BlackHole).',
      mac4: 'В Telegram: Call settings → Microphone = BlackHole. Перезайдите в чат.',
      assetsTitle: 'Файлы релиза',
      note: 'Каждый push в main собирает установщики и публикует Release. Приложение само проверяет обновления.',
      footerMit: 'BoysChanger · MIT · Hyperlinks Space',
      footerHs: 'Hyperlinks Space Program',
      footerSrc: 'Исходники на GitHub',
      language: 'Язык',
      noAssets: 'Бинарников пока нет. Сделайте push в main для релиза.',
      releaseMeta: 'Последний релиз {tag}{date}',
      releaseUnavailable: 'Релиз пока недоступен — смотрите GitHub Releases после первого push.',
      openReleases: 'Открыть релизы на GitHub',
    },
  };

  function detectFromNavigator() {
    const candidates = [
      ...(navigator.languages || []),
      navigator.language,
      navigator.userLanguage,
    ]
      .filter(Boolean)
      .map((l) => String(l).toLowerCase().replace(/_/g, '-'));
    for (const lang of candidates) {
      if (lang.startsWith('zh')) return 'zh';
      if (lang.startsWith('ru')) return 'ru';
    }
    return 'en';
  }

  function detect() {
    // Explicit user choice only — do not lock auto-detect into localStorage
    const user = localStorage.getItem('boyschanger-site-locale-user');
    if (user && dict[user]) return user;
    // Migrate old key if it was set by the language dropdown (best-effort)
    const legacy = localStorage.getItem('boyschanger-site-locale');
    if (legacy && dict[legacy] && localStorage.getItem('boyschanger-site-locale-locked') === '1') {
      return legacy;
    }
    return detectFromNavigator();
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
        localStorage.setItem('boyschanger-site-locale-user', locale);
        localStorage.setItem('boyschanger-site-locale', locale);
        localStorage.setItem('boyschanger-site-locale-locked', '1');
        apply();
        loadRelease();
      });
    }
    // Clear stale auto-saved locale from older builds (was written on every visit)
    if (!localStorage.getItem('boyschanger-site-locale-user')) {
      localStorage.removeItem('boyschanger-site-locale');
      localStorage.removeItem('boyschanger-site-locale-locked');
      locale = detectFromNavigator();
    }
    apply();
    loadRelease();
  });
})();
