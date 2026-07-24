/// <reference types="vite/client" />
/// <reference types="vite-plugin-electron/electron-env" />

import type { BoysChangerApi } from '../electron/preload';

declare global {
  interface Window {
    boysChanger: BoysChangerApi;
  }

  interface HTMLMediaElement {
    setSinkId?(sinkId: string): Promise<void>;
  }

  interface MediaTrackConstraintSet {
    deviceId?: string | ConstrainDOMString;
  }

  interface ImportMetaEnv {
    readonly VITE_APP_VERSION?: string;
  }
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '@soundtouchjs/formant-correction-worklet/processor?url' {
  const src: string;
  export default src;
}

export {};
