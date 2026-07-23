# BoysChanger

<p align="center">
  <img src="brand/banner.png" alt="BoysChanger — 系统级变声器" width="100%" />
</p>

<p align="center">
  <img src="brand/logo.svg" alt="BoysChanger 标志" width="96" height="96" />
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <strong>中文</strong> ·
  <a href="brand/TELEGRAM_ANNOUNCE.md">📣 Telegram 文案</a>
</p>

<p align="center">
  <strong>适用于 Windows 与 macOS 的系统级变声器</strong><br/>
  由 <a href="https://github.com/HyperlinksSpace">HyperlinksSpace</a> 出品
</p>

<p align="center">
  <a href="https://hyperlinksspace.github.io/BoysChanger/">官网</a> ·
  <a href="https://github.com/HyperlinksSpace/BoysChanger/releases/latest">下载</a> ·
  <a href="https://www.hyperlinks.space/">Hyperlinks Space</a> ·
  <a href="brand/boyschanger-social.png">社交分享图</a>
</p>

调节种族、性别、年龄、音色、增益与音量；叠加 echo、wah-wah、distortion、reverb、chorus、robot、flanger、bitcrush；试听最近 **11 秒**；通过虚拟声卡将结果设为系统麦克风。

> **自动更新说明：** 若版本为 **1.0.5 或更早**，请先从 [最新 Release](https://github.com/HyperlinksSpace/BoysChanger/releases/latest) 手动安装一次。自 **v1.0.6+** 起会自动更新。

## 功能

- **ON/OFF** 主开关
- 声音角色：种族、性别、年龄、音色、增益、音量
- 效果可同时开启，并共享混合滑条
- **试听**：最近 11 秒处理后的声音
- **音效库**：内置 FX + 上传自己的 MP3（扬声器与虚拟声卡同时播放）
- 系统级路由：VB-Cable（Windows）或 BlackHole（macOS）
- 语言：English、中文、Русский
- GitHub Releases 自动更新
- 推送到 `main` 自动发版
- GitHub Pages 展示站

## 用户安装

### Windows

1. 安装 [VB-Cable](https://vb-audio.com/Cable/) 并重启
2. 从 [Releases](https://github.com/HyperlinksSpace/BoysChanger/releases) 安装 BoysChanger
3. **输入**选择真实硬件麦克风（不要选 Voicemod / CABLE）
4. **输出**设为 **CABLE Input**
5. 点击 **设为系统输入**（或将 Windows 默认录音设备设为 **CABLE Output**）
6. 打开变声器（**ON**）

可选：`Install-Module AudioDeviceCmdlets` 以便应用自动切换系统麦克风。

### macOS

1. 安装 [BlackHole 2ch](https://existential.audio/blackhole/)
2. 从 Releases 安装（未签名构建：首次请右键 → 打开）
3. **输出**设为 **BlackHole 2ch**
4. **设为系统输入**（或在系统声音输入中选择 BlackHole）
5. 打开变声器（**ON**）

可选：`brew install switchaudio-osx`。

### Telegram / Discord 语音

1. 输出 = **CABLE Input**（Win）/ **BlackHole**（Mac）
2. 系统输入 = **CABLE Output** / BlackHole
3. 变声器 **ON**
4. 在 Telegram/Discord 中选择该麦克风，并**重新加入**语音通话

### 调试日志

- `%APPDATA%\BoysChanger\logs\boyschanger.log`
- 应用内 **Logs** 按钮可打开目录
- 最近 2 次试听：`prehear-1.wav` / `prehear-2.wav`（及 `.json`）

### 自动更新

约每 **30 分钟**检查一次，网络失败会重试，下载后自动重启到新版本。公开仓库无需 token；如遇限流可设置 `GH_TOKEN`。

## 社交 / Telegram

- 📣 可直接粘贴的俄语 Telegram 文案：[`brand/TELEGRAM_ANNOUNCE.md`](brand/TELEGRAM_ANNOUNCE.md)
- 多语言公告：[`brand/ANNOUNCE.md`](brand/ANNOUNCE.md)
- 分享图：[`brand/boyschanger-social.png`](brand/boyschanger-social.png)

## 开发

```bash
npm install
npm run dev
```

```bash
npm run pack:win
npm run pack:mac
```

## GitHub 自动化

| Workflow | 触发 | 结果 |
|---|---|---|
| `.github/workflows/release.yml` | Push 到 `main` / `master` | Windows + macOS → Release |
| `.github/workflows/pages.yml` | Push 到 `main` / `master` | 部署站点 |

官网：https://hyperlinksspace.github.io/BoysChanger/

## 品牌资源

- 标志：[`brand/logo.svg`](brand/logo.svg)
- Banner：[`brand/banner.png`](brand/banner.png)
- 社交图：[`brand/boyschanger-social.png`](brand/boyschanger-social.png)

## 许可

MIT
