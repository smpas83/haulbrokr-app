import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoPlayer } from "@/lib/video";
import { Scene1 } from "./video_scenes/Scene1";
import { Scene2 } from "./video_scenes/Scene2";
import { Scene3 } from "./video_scenes/Scene3";
import { Scene4 } from "./video_scenes/Scene4";
import { Scene5 } from "./video_scenes/Scene5";

export const SCENE_DURATIONS = {
  open: 4000,
  build1: 4500,
  build2: 4000,
  build3: 4500,
  close: 4000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  open: Scene1,
  build1: Scene2,
  build2: Scene3,
  build3: Scene4,
  close: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(
    /_r[12]$/,
    "",
  ) as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-bg-dark text-text-inverse font-body">
      {/* Persistent background layers */}

      <AnimatePresence>
        {sceneIndex === 0 && (
          <motion.div
            key="bg-0"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <video
              src={`${import.meta.env.BASE_URL}videos/intro.mp4`}
              autoPlay
              muted
              loop
              playsInline
              className="absolute w-full h-full object-cover opacity-40 mix-blend-luminosity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/50 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-bg-dark via-bg-dark to-secondary"
        animate={{
          opacity: sceneIndex === 0 ? 0.8 : 1,
        }}
        transition={{ duration: 1 }}
      />

      {/* Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        className="absolute rounded-full blur-[100px] pointer-events-none"
        animate={{
          x: ["-20vw", "10vw", "60vw", "40vw", "50vw"][sceneIndex],
          y: ["-20vh", "50vh", "10vh", "70vh", "50vh"][sceneIndex],
          scale: [1, 1.5, 2, 1, 1.5][sceneIndex],
          backgroundColor: [
            "#F97316",
            "#3B82F6",
            "#10B981",
            "#F97316",
            "#F97316",
          ][sceneIndex],
          width: ["40vw", "50vw", "30vw", "60vw", "50vw"][sceneIndex],
          height: ["40vh", "50vh", "30vh", "60vh", "50vh"][sceneIndex],
          opacity: [0.15, 0.1, 0.15, 0.1, 0.2][sceneIndex],
        }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.div
        className="absolute w-[2px] bg-primary origin-top"
        animate={{
          left: ["10%", "80%", "5%", "90%", "50%"][sceneIndex],
          height: ["0%", "100%", "30%", "100%", "0%"][sceneIndex],
          opacity: [0, 0.5, 0.8, 0.3, 0][sceneIndex],
        }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
