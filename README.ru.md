# BoysChanger

<p align="center">
  <img src="brand/banner.png" alt="BoysChanger — системный войс-чейнджер" width="100%" />
</p>

<p align="center">
  <img src="brand/logo.svg" alt="Логотип BoysChanger" width="96" height="96" />
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <strong>Русский</strong> ·
  <a href="README.zh.md">中文</a> ·
  <a href="brand/TELEGRAM_ANNOUNCE.md">📣 Анонс для Telegram</a>
</p>

<p align="center">
  <strong>Системный войс-чейнджер для Windows и macOS</strong><br/>
  от <a href="https://github.com/HyperlinksSpace">HyperlinksSpace</a>
</p>

<p align="center">
  <a href="https://hyperlinksspace.github.io/BoysChanger/">Сайт</a> ·
  <a href="https://github.com/HyperlinksSpace/BoysChanger/releases/latest">Скачать</a> ·
  <a href="https://www.hyperlinks.space/">Hyperlinks Space</a> ·
  <a href="brand/boyschanger-social.png">Картинка для соцсетей</a>
</p>

Меняйте расу, пол, возраст, тембр, усиление и громкость; накладывайте echo, wah-wah, distortion, reverb, chorus, robot, flanger и bitcrush; слушайте последние **11 секунд**; отправляйте результат через виртуальный кабель как системный микрофон.

> **Автообновление:** если у вас версия **1.0.5 или старше**, один раз поставьте сборку с [latest Release](https://github.com/HyperlinksSpace/BoysChanger/releases/latest). С **v1.0.6+** обновления ставятся сами.

## Возможности

- Переключатель **ON/OFF**
- Характер голоса: раса, пол, возраст, тембр, усиление, громкость
- Эффекты можно включать вместе, с общим миксом
- **Prehear** — последние 11 секунд обработанного голоса
- **Библиотека звуков** — встроенные FX + свои MP3 (в динамики и в виртуальный кабель)
- Системная маршрутизация: VB-Cable (Windows) или BlackHole (macOS)
- Языки: English, 中文, Русский
- Автообновление с GitHub Releases
- Автосборка релизов при пуше в `main`
- Сайт на GitHub Pages

## Установка

### Windows

1. Поставьте BoysChanger из [Releases](https://github.com/HyperlinksSpace/BoysChanger/releases) — установщик **включает VB-CABLE** и может поставить драйвер при установке
2. **Перезагрузитесь** после установки VB-CABLE
3. **Вход** — ваш **настоящий** микрофон (не Voicemod / CABLE)
4. **Выход** — **CABLE Input**
5. Нажмите **Настроить для Telegram** / **Сделать системным входом**
6. Включите чейнджер (**ON**)

Если кабеля нет: панель Telegram → **Установить вирт. кабель**. VB-CABLE — donationware от [VB-Audio](https://www.vb-cable.com/).

### macOS

1. Установите [BlackHole 2ch](https://existential.audio/blackhole/)
2. Поставьте BoysChanger из Releases (неподписанные сборки: правый клик → Открыть)
3. **Выход** — **BlackHole 2ch**
4. **Сделать системным входом** (или выберите BlackHole во входе звука)
5. Включите чейнджер (**ON**)

Опционально: `brew install switchaudio-osx`.

### Telegram / Discord

Telegram Desktop **сам** не подхватывает BoysChanger: у звонков свой микрофон, а голосовые часто идут с системного микрофона по умолчанию.

1. Установите **VB-Cable** (Win) / **BlackHole** (Mac)
2. BoysChanger: вход = реальный микрофон, выход = **CABLE Input** / **BlackHole**
3. Нажмите **Настроить для Telegram** в приложении
4. Telegram Desktop → **Настройки → Дополнительно → Настройки звонков → Устройство ввода** = **CABLE Output** / **BlackHole**
5. **Выйдите и зайдите снова** в голосовой чат; держите BoysChanger **ON**
6. Для голосовых: также сделайте CABLE Output / BlackHole устройством записи по умолчанию в ОС

Мобильный Telegram виртуальный кабель не поддерживает.

### Логи для отладки

- `%APPDATA%\BoysChanger\logs\boyschanger.log`
- Кнопка **Logs** в приложении открывает папку
- Последние 2 prehear: `prehear-1.wav` / `prehear-2.wav` (+ `.json`)

### Автообновление

Проверка примерно раз в **30 минут**, повтор при сбоях сети, скачивание и перезапуск в новую версию. Для публичного репо токен не нужен; при лимитах GitHub можно задать `GH_TOKEN`.

## Соцсети / Telegram

- 📣 Готовый пост для Telegram (скопировать-вставить): [`brand/TELEGRAM_ANNOUNCE.md`](brand/TELEGRAM_ANNOUNCE.md)
- Тексты анонса RU / EN / 中文: [`brand/ANNOUNCE.md`](brand/ANNOUNCE.md)
- Картинка: [`brand/boyschanger-social.png`](brand/boyschanger-social.png)

## Разработка

```bash
npm install
npm run dev
```

```bash
npm run pack:win
npm run pack:mac
```

## Автоматизация GitHub

| Workflow | Когда | Что делает |
|---|---|---|
| `.github/workflows/release.yml` | Push в `main` / `master` | Сборки Windows + macOS → Release |
| `.github/workflows/pages.yml` | Push в `main` / `master` | Деплой сайта |

Сайт: https://hyperlinksspace.github.io/BoysChanger/

## Бренд

- Логотип: [`brand/logo.svg`](brand/logo.svg)
- Баннер: [`brand/banner.png`](brand/banner.png)
- Соцкартинка: [`brand/boyschanger-social.png`](brand/boyschanger-social.png)

## Лицензия

MIT
