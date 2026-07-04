import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative text-center max-w-4xl px-8">
        <motion.p
          className="text-[2vw] text-text-muted font-medium tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          Construction Logistics
        </motion.p>

        <h1 className="text-[6vw] font-display font-bold leading-[1.1] tracking-tight">
          <motion.span
            className="block text-white"
            initial={{ opacity: 0, rotateX: 90, y: 40 }}
            animate={
              phase >= 1
                ? { opacity: 1, rotateX: 0, y: 0 }
                : { opacity: 0, rotateX: 90, y: 40 }
            }
            transition={{ duration: 1, type: "spring", bounce: 0.4 }}
          >
            Finding reliable
          </motion.span>
          <motion.span
            className="block text-primary"
            initial={{ opacity: 0, rotateX: 90, y: 40 }}
            animate={
              phase >= 2
                ? { opacity: 1, rotateX: 0, y: 0 }
                : { opacity: 0, rotateX: 90, y: 40 }
            }
            transition={{ duration: 1, type: "spring", bounce: 0.4 }}
          >
            haulers is hard.
          </motion.span>
        </h1>
      </div>
    </motion.div>
  );
}
