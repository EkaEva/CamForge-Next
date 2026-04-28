import React from 'react';
import { Composition } from 'remotion';
import { CamForgeSplash } from './CamForgeSplash';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CamForgeSplash"
        component={CamForgeSplash}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
