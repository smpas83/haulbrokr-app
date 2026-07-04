import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 2400),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const steps = [
    { title: "Post a job", desc: "Specify material & location" },
    { title: "Get bids", desc: "Vetted providers compete" },
    { title: "Track & pay", desc: "Secure end-to-end" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center px-24 z-10"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2
        className="text-[4vw] font-display font-bold text-white mb-16 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ duration: 0.8 }}
      >
        How it works
      </motion.h2>

      <div className="flex gap-8 justify-center">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={
              phase >= i + 2
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 40, scale: 0.9 }
            }
            transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
          >
            <div className="text-primary text-[3vw] font-display font-bold mb-4 opacity-50">
              0{i + 1}
            </div>
            <h3 className="text-[2vw] font-bold text-white mb-2">
              {step.title}
            </h3>
            <p className="text-[1.2vw] text-text-muted">{step.desc}</p>

            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-primary"
              initial={{ width: 0 }}
              animate={phase >= i + 2 ? { width: "100%" } : { width: 0 }}
              transition={{ duration: 1.5, delay: 0.2 }}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
