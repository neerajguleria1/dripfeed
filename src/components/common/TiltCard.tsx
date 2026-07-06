import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

export function TiltCard({ children, className = '' }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Disable 3D tilt on touch devices
    const isTouch = !window.matchMedia('(pointer: fine)').matches || 'ontouchstart' in window;
    setIsTouchDevice(isTouch);
  }, []);

  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 20 });

  function handleMouseMove(e: React.MouseEvent) {
    if (isTouchDevice) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    if (isTouchDevice) return;
    mx.set(0);
    my.set(0);
  }

  // On touch devices, render without 3D transform
  if (isTouchDevice) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ perspective: 800 }} className={className}>
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
