import { motion, type HTMLMotionProps, type Transition } from "framer-motion";
import { animation } from "@workspace/design-tokens";
import type { ReactNode } from "react";

const { presets } = animation;

type MotionDivProps = HTMLMotionProps<"div">;

function durationSeconds(ms: number) {
  return ms / 1000;
}

function transition(preset: { duration: number; easing: string }): Transition {
  return {
    duration: durationSeconds(preset.duration),
    ease: preset.easing as Transition["ease"],
  };
}

export function FadeIn({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.fadeIn;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition(preset)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.slideUp;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={transition(preset)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.scaleIn;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={transition(preset)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function HoverCard({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.hoverCard;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={transition(preset)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function LoadingTransition({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.loading;
  return (
    <motion.div
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ ...transition(preset), repeat: Infinity, repeatType: "reverse" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ children, ...props }: { children: ReactNode } & MotionDivProps) {
  const preset = presets.page;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition(preset)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
