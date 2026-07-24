import React, { useEffect } from 'react';
import type { MessageKey } from '../i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  platform: string;
  cablePresent: boolean;
  cableInstallerReady: boolean;
  outputIsCable: boolean;
  engineOn: boolean;
  busy: boolean;
  cableInstallBusy: boolean;
  tr: (key: MessageKey, vars?: Record<string, string | number>) => string;
  onSetup: () => void;
  onInstallCable: () => void;
  onOpenSound: () => void;
};

export function TelegramGuideModal({
  open,
  onClose,
  platform,
  cablePresent,
  cableInstallerReady,
  outputIsCable,
  engineOn,
  busy,
  cableInstallBusy,
  tr,
  onSetup,
  onInstallCable,
  onOpenSound,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet telegram-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="telegram-guide-title">{tr('telegramTitle')}</h2>
          <button type="button" className="secondary guide-toggle" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-scroll">
          <p className="telegram-why">{tr('telegramWhy')}</p>
          <ul className="telegram-checks">
            <li className={cablePresent ? 'ok' : 'bad'}>
              {cablePresent
                ? tr('telegramCableOk')
                : cableInstallerReady
                  ? `${tr('telegramCableMissing')} (${tr('cableBundledOk')})`
                  : tr('telegramCableMissing')}
            </li>
            <li className={outputIsCable ? 'ok' : 'bad'}>
              {outputIsCable ? tr('telegramOutputOk') : tr('telegramOutputNeed')}
            </li>
            <li className={engineOn ? 'ok' : 'bad'}>
              {engineOn ? tr('telegramEngineOk') : tr('telegramEngineNeed')}
            </li>
          </ul>
          <ol className="telegram-steps">
            <li>{tr('telegramStep1')}</li>
            <li>{platform === 'darwin' ? tr('telegramStep2Mac') : tr('telegramStep2Win')}</li>
            <li>{tr('telegramStep3')}</li>
            <li>{platform === 'darwin' ? tr('telegramStep4Mac') : tr('telegramStep4Win')}</li>
            <li>{tr('telegramStep5')}</li>
          </ol>
          <p className="telegram-note">
            {platform === 'darwin' ? tr('telegramVoiceMsgMac') : tr('telegramVoiceMsgWin')}
          </p>
          <p className="telegram-note muted">{tr('telegramDesktopOnly')}</p>
          <p className="telegram-note muted">{tr('cableDonate')}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-action" disabled={busy} onClick={onSetup}>
            {tr('telegramSetupBtn')}
          </button>
          {!cablePresent ? (
            <button
              type="button"
              className="primary-action"
              disabled={busy || cableInstallBusy}
              onClick={onInstallCable}
            >
              {platform === 'darwin' ? tr('telegramInstallCableMac') : tr('telegramInstallCableWin')}
            </button>
          ) : null}
          <button type="button" className="secondary" onClick={onOpenSound}>
            {tr('telegramOpenSound')}
          </button>
        </div>
      </div>
    </div>
  );
}
