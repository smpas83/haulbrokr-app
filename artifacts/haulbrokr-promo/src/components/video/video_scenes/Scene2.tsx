import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center p-24 z-10"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="absolute right-0 top-0 w-2/3 h-full"
        initial={{ opacity: 0, scale: 1.2, clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
        animate={phase >= 1 ? { 
          opacity: 1, 
          scale: 1, 
          clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' 
        } : {}}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/site.jpg`} 
          className="w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-dark via-bg-dark/80 to-transparent" />
      </motion.div>

      <div className="relative z-20 max-w-2xl">
        <motion.div
          className="w-20 h-2 bg-primary mb-8"
          initial={{ width: 0 }}
          animate={phase >= 2 ? { width: 80 } : { width: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        
        <h2 className="text-[5vw] font-display font-bold leading-none mb-6">
          <motion.span
            className="block text-white"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Until HaulBrokr.
          </motion.span>
        </h2>
        
        <motion.p 
          className="text-[2vw] text-text-muted leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          The marketplace for material hauling and dump runs.
        </motion.p>
      </div>
    </motion.div>
  );
}