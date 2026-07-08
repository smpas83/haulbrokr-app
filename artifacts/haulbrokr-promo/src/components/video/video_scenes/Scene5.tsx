import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-32 h-32 mb-8 relative"
        initial={{ opacity: 0, rotate: -90, scale: 0 }}
        animate={phase >= 1 ? { opacity: 1, rotate: 0, scale: 1 } : {}}
        transition={{ duration: 1, type: "spring", bounce: 0.5 }}
      >
        <div className="absolute inset-0 bg-primary rounded-2xl rotate-12 opacity-50 blur-lg" />
        <div className="absolute inset-0 bg-primary rounded-2xl flex items-center justify-center text-bg-dark font-display font-bold text-6xl">
          H
        </div>
      </motion.div>

      <motion.h1
        className="text-[7vw] font-display font-bold text-white tracking-tight leading-none mb-6"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        HaulBrokr
      </motion.h1>

      <motion.p
        className="text-[2vw] text-text-muted font-medium tracking-wide"
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={phase >= 2 ? { opacity: 1, filter: "blur(0px)" } : {}}
        transition={{ duration: 1 }}
      >
        Moving materials, made simple.
      </motion.p>
    </motion.div>
  );
}
