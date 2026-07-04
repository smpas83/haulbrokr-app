import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2000),
    ];
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center z-10"
      initial={{ opacity: 0, filter: "blur(20px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="absolute left-0 top-0 w-1/2 h-full"
        initial={{ opacity: 0, x: -50 }}
        animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/truck.jpg`}
          className="w-full h-full object-cover opacity-80 mix-blend-screen grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-bg-dark via-bg-dark/50 to-transparent" />
      </motion.div>

      <div className="w-1/2 ml-auto pr-24 pl-12">
        <motion.h2
          className="text-[4vw] font-display font-bold leading-none mb-12 text-primary"
          initial={{ opacity: 0, x: 50 }}
          animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.8 }}
        >
          Built on Trust.
        </motion.h2>

        <div className="space-y-8">
          {[
            "DOT/CDL Compliance Verified",
            "Live GPS Haul Tracking",
            "Secure Managed Payments",
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-6"
              initial={{ opacity: 0, x: 30 }}
              animate={
                phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }
              }
              transition={{ duration: 0.6, type: "spring" }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary">
                <div className="w-3 h-3 bg-primary rounded-full" />
              </div>
              <p className="text-[2vw] text-white font-medium">{item}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
