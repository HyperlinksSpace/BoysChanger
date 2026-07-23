# BoysChanger

<p align="center">
  <img src="brand/banner.png" alt="BoysChanger — system-wide voice changer" width="100%" />
</p>

<p align="center">
  <img src="brand/logo.svg" alt="BoysChanger logo" width="96" height="96" />
</p>

<p align="center">
  <strong>System-wide voice changer for Windows and macOS</strong><br/>
  by <a href="https://github.com/HyperlinksSpace">HyperlinksSpace</a>
</p>

<p align="center">
  <a href="https://hyperlinksspace.github.io/BoysChanger/">Website</a> ·
  <a href="https://github.com/HyperlinksSpace/BoysChanger/releases/latest">Downloads</a> ·
  <a href="https://www.hyperlinks.space/">Hyperlinks Space</a>
</p>

Shape race, gender, age, timbre, amplifier, and volume; stack echo, wah-wah, distortion, reverb, chorus, robot, flanger, and bitcrush; prehear the last **11 seconds**; route the result through a virtual cable as your OS microphone.

> **Auto-update note:** Install from the [latest Release](https://github.com/HyperlinksSpace/BoysChanger/releases/latest) once if you are on 1.0.5 or earlier — those builds used prerelease-style Git tags and skipped updates. From **v1.0.6+** updates apply automatically.

## Features

- **ON/OFF** master toggle for the voice changer
- **Character controls**: race, gender, age, timbre, amplifier, volume
- **Effects**: all can be enabled at the same time, with a shared mix slider
- **Prehear**: replay the last 11 seconds of processed voice
- **System-wide routing**: output to VB-Cable (Windows) or BlackHole (macOS), then set it as the system input
- **Languages**: English, 中文, Русский (follows system language on first launch)
- **Auto-update**: checks GitHub Releases and installs updates automatically
- **Auto-release**: every push to `main` builds installers and publishes a GitHub Release
- **GitHub Pages** site with presentation + download links (`/site`)

## Setup (users)

### Windows

1. Install [VB-Cable](https://vb-audio.com/Cable/) and reboot
2. Install BoysChanger from [Releases](https://github.com/HyperlinksSpace/BoysChanger/releases)
3. In the app, set **Output** to **CABLE Input**
4. Click **Apply as system input** (or set Windows default recording device to **CABLE Output**)
5. Turn the changer **ON**

Optional: `Install-Module AudioDeviceCmdlets` enables automatic default-mic switching from the app.

### macOS

1. Install [BlackHole 2ch](https://existential.audio/blackhole/)
2. Install BoysChanger from Releases (unsigned CI builds: right-click → Open the first time)
3. Set **Output** to **BlackHole 2ch**
4. Click **Apply as system input** (or set Sound input to BlackHole)
5. Turn the changer **ON**

Optional: `brew install switchaudio-osx` for automatic input switching.

### Telegram / Discord voice chat

1. Output = **CABLE Input** (Win) / **BlackHole** (Mac)
2. Click **Apply as system input** (or set OS default mic to **CABLE Output** / BlackHole)
3. Turn changer **ON**
4. In Telegram/Discord: set **Microphone** to **CABLE Output** / BlackHole, then **rejoin** the voice chat (apps often lock the mic at call start)

Sound-library clips and prehear playback go to **both** your speakers and the virtual cable, so the other side hears them too.

## Develop

```bash
npm install
npm run dev
```

Build locally:

```bash
npm run pack:win   # Windows
npm run pack:mac   # macOS
```

## GitHub automation

| Workflow | Trigger | Result |
|---|---|---|
| `.github/workflows/release.yml` | Push to `main` / `master` | Windows + macOS builds → GitHub Release |
| `.github/workflows/pages.yml` | Push to `main` / `master` | Deploys presentation site |

Enable **Settings → Pages → GitHub Actions** after the first Pages workflow run.

Site: https://hyperlinksspace.github.io/BoysChanger/

## Brand

- Mark (SVG): [`brand/logo.svg`](brand/logo.svg) — scales from favicon to app icon
- Compact mark: [`brand/logo-mark.svg`](brand/logo-mark.svg)
- Banner: [`brand/banner.png`](brand/banner.png)

## License

MIT
