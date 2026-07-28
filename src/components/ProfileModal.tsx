import React, { useEffect, useRef, useState } from 'react';
import type { MessageKey } from '../i18n';
import {
  ACC_OPTIONS,
  DEFAULT_COMPOSE,
  EYES_OPTIONS,
  HAIR_OPTIONS,
  MOOD_OPTIONS,
  SKIN_OPTIONS,
  clearUploadedAvatar,
  saveComposedProfile,
  saveUploadedAvatar,
  type AccId,
  type ComposedAvatar,
  type EyesId,
  type HairId,
  type MoodId,
  type SkinId,
  type UserProfile,
} from '../profile/userProfile';
import { ProfileAvatar, SkinSwatch } from './ProfileAvatar';

type Props = {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSaved: (next: UserProfile) => void;
  tr: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

export function ProfileModal({ open, onClose, profile, onSaved, tr }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.displayName);
  const [draft, setDraft] = useState<ComposedAvatar>(
    profile.avatar.mode === 'compose' ? profile.avatar : { ...DEFAULT_COMPOSE },
  );
  const [mode, setMode] = useState<'compose' | 'upload'>(profile.avatar.mode);
  const [uploadPreview, setUploadPreview] = useState(
    profile.avatar.mode === 'upload' ? profile.avatar.previewUrl : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(profile.displayName);
    setDraft(profile.avatar.mode === 'compose' ? profile.avatar : { ...DEFAULT_COMPOSE });
    setMode(profile.avatar.mode);
    setUploadPreview(profile.avatar.mode === 'upload' ? profile.avatar.previewUrl : '');
    setError('');
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setSkin = (skin: SkinId) => setDraft((d) => ({ ...d, skin }));
  const setHair = (hair: HairId) => setDraft((d) => ({ ...d, hair }));
  const setEyes = (eyes: EyesId) => setDraft((d) => ({ ...d, eyes }));
  const setAcc = (accessory: AccId) => setDraft((d) => ({ ...d, accessory }));
  const setMood = (mood: MoodId) => setDraft((d) => ({ ...d, mood }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'compose') {
        const next = await saveComposedProfile(name, draft);
        onSaved(next);
        onClose();
        return;
      }
      if (!uploadPreview) {
        setError(tr('profileUploadNeed'));
        return;
      }
      const blob = await fetch(uploadPreview).then((r) => r.blob());
      const next = await saveUploadedAvatar(name, blob);
      onSaved(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const next = await saveUploadedAvatar(name, file);
      setMode('upload');
      setUploadPreview(next.avatar.mode === 'upload' ? next.avatar.previewUrl : '');
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const usePremade = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await clearUploadedAvatar(name);
      setMode('compose');
      setUploadPreview('');
      setDraft(next.avatar.mode === 'compose' ? next.avatar : { ...DEFAULT_COMPOSE });
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="profile-title">{tr('profileTitle')}</h2>
          <button type="button" className="secondary guide-toggle" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-scroll profile-scroll">
          <p className="hint">{tr('profileLede')}</p>

          <div className="profile-preview-row">
            <div className="profile-preview-art">
              <ProfileAvatar
                avatar={mode === 'upload' && uploadPreview ? { mode: 'upload', previewUrl: uploadPreview } : draft}
                className="profile-avatar xl"
              />
            </div>
            <div className="profile-preview-meta">
              <label>
                {tr('profileName')}
                <input
                  type="text"
                  value={name}
                  maxLength={32}
                  placeholder={tr('profileNamePlaceholder')}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className="hint tight">{tr('profileLocalOnly')}</p>
            </div>
          </div>

          <div className="profile-mode-row">
            <button
              type="button"
              className={mode === 'compose' ? 'chip active' : 'chip'}
              onClick={() => {
                if (mode === 'upload') void usePremade();
                else setMode('compose');
              }}
            >
              {tr('profilePremade')}
            </button>
            <button
              type="button"
              className={mode === 'upload' ? 'chip active' : 'chip'}
              onClick={() => fileRef.current?.click()}
            >
              {tr('profileUpload')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </div>

          {mode === 'compose' ? (
            <div className="profile-layers">
              <section>
                <h3>{tr('profileSkin')}</h3>
                <div className="profile-option-row">
                  {SKIN_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`profile-opt ${draft.skin === s.id ? 'active' : ''}`}
                      title={s.label}
                      onClick={() => setSkin(s.id)}
                    >
                      <SkinSwatch color={s.color} active={draft.skin === s.id} />
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3>{tr('profileHair')}</h3>
                <div className="profile-option-row wrap">
                  {HAIR_OPTIONS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={draft.hair === h.id ? 'chip active' : 'chip'}
                      onClick={() => setHair(h.id)}
                    >
                      {tr(`profileHair_${h.id}` as MessageKey)}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3>{tr('profileEyes')}</h3>
                <div className="profile-option-row wrap">
                  {EYES_OPTIONS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={draft.eyes === e.id ? 'chip active' : 'chip'}
                      onClick={() => setEyes(e.id)}
                    >
                      {tr(`profileEyes_${e.id}` as MessageKey)}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3>{tr('profileMood')}</h3>
                <div className="profile-option-row wrap">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={draft.mood === m.id ? 'chip active' : 'chip'}
                      onClick={() => setMood(m.id)}
                    >
                      {tr(`profileMood_${m.id}` as MessageKey)}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3>{tr('profileAccessory')}</h3>
                <div className="profile-option-row wrap">
                  {ACC_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={draft.accessory === a.id ? 'chip active' : 'chip'}
                      onClick={() => setAcc(a.id)}
                    >
                      {tr(`profileAcc_${a.id}` as MessageKey)}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="profile-upload-pane">
              <p className="hint">{tr('profileUploadHint')}</p>
              <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
                {tr('profileUploadReplace')}
              </button>
            </div>
          )}

          {error ? <p className="profile-error">{error}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose} disabled={busy}>
            {tr('profileCancel')}
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={() => void save()}
          >
            {tr('profileSave')}
          </button>
        </div>
      </div>
    </div>
  );
}
