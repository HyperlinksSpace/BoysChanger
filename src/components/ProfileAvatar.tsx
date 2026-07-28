import React, { useEffect, useState } from 'react';
import {
  ACC_OPTIONS,
  avatarAccent,
  avatarForm,
  type ProfileAvatar as ProfileAvatarData,
} from '../profile/userProfile';
import { SceneChip } from './SceneChip';

type Props = {
  avatar: ProfileAvatarData;
  className?: string;
  title?: string;
};

/** Lightweight avatar face — SceneChip matches dashboard hero language when not uploading. */
export function ProfileAvatar({ avatar, className, title }: Props) {
  const [uploadBroken, setUploadBroken] = useState(false);
  const previewUrl = avatar.mode === 'upload' ? avatar.previewUrl : null;

  useEffect(() => {
    setUploadBroken(false);
  }, [previewUrl]);

  if (avatar.mode === 'upload' && previewUrl && !uploadBroken) {
    return (
      <span className={className || 'profile-avatar'} title={title}>
        <span className="profile-avatar-stage" />
        <span className="profile-avatar-rim" />
        <img
          src={previewUrl}
          alt=""
          className="profile-avatar-img"
          draggable={false}
          onError={() => setUploadBroken(true)}
        />
      </span>
    );
  }

  return (
    <span className={className || 'profile-avatar'} title={title}>
      <SceneChip variant={avatarForm(avatar)} accent={avatarAccent(avatar)} />
    </span>
  );
}

export function SkinSwatch({ color, active }: { color: string; active?: boolean }) {
  return (
    <span
      className={`profile-swatch ${active ? 'active' : ''}`}
      style={{ background: color === 'transparent' ? '#222' : color }}
    />
  );
}

export { ACC_OPTIONS };
