import { useEffect, useRef, useState } from "react";
import { Truck, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapPin {
  id: number;
  x: number;
  y: number;
  label: string;
  value: string;
  delay: number;
}

interface TruckRoute {
  id: number;
  y: number;
  speed: number;
  delay: number;
}

const PINS: MapPin[] = [
  { id: 1, x: 18, y: 42, label: "Houston, TX", value: "$2,400", delay: 0 },
  { id: 2, x: 32, y: 28, label: "Denver, CO", value: "$1,850", delay: 0.3 },
  { id: 3, x: 48, y: 35, label: "Chicago, IL", value: "$3,100", delay: 0.6 },
  { id: 4, x: 62, y: 48, label: "Atlanta, GA", value: "$2,750", delay: 0.9 },
  { id: 5, x: 75, y: 32, label: "New York, NY", value: "$4,200", delay: 1.2 },
  { id: 6, x: 12, y: 55, label: "Phoenix, AZ", value: "$1,600", delay: 1.5 },
  { id: 7, x: 85, y: 52, label: "Miami, FL", value: "$2,900", delay: 1.8 },
  { id: 8, x: 55, y: 58, label: "Dallas, TX", value: "$2,100", delay: 2.1 },
];

const TRUCKS: TruckRoute[] = [
  { id: 1, y: 38, speed: 12, delay: 0 },
  { id: 2, y: 45, speed: 15, delay: 3 },
  { id: 3, y: 52, speed: 10, delay: 6 },
];

export function AnimatedNationMap({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activePin, setActivePin] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(59, 130, 246, 0.06)";
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
      for (let j = 0; j < h; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(w, j);
        ctx.stroke();
      }

      // Heat zones
      PINS.forEach((pin) => {
        const px = (pin.x / 100) * w;
        const py = (pin.y / 100) * h;
        const pulse = Math.sin(t * 0.02 + pin.delay * 2) * 0.3 + 0.7;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 60 * pulse);
        grad.addColorStop(0, "rgba(59, 130, 246, 0.12)");
        grad.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 60 * pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      // Connection lines between pins
      ctx.strokeStyle = "rgba(59, 130, 246, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < PINS.length - 1; i++) {
        const a = PINS[i];
        const b = PINS[i + 1];
        ctx.beginPath();
        ctx.moveTo((a.x / 100) * w, (a.y / 100) * h);
        ctx.lineTo((b.x / 100) * w, (b.y / 100) * h);
        ctx.stroke();
      }

      t++;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={cn("relative w-full h-full min-h-[400px] overflow-hidden rounded-2xl", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* USA outline silhouette */}
      <svg
        viewBox="0 0 1000 600"
        className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="currentColor"
          className="text-primary"
          d="M150,200 L200,180 L280,190 L350,170 L420,185 L500,160 L580,175 L650,165 L720,180 L800,170 L850,200 L870,250 L860,320 L840,380 L800,420 L750,450 L700,470 L650,480 L600,490 L550,500 L500,510 L450,505 L400,495 L350,480 L300,460 L250,430 L200,400 L170,350 L155,300 Z"
        />
      </svg>

      {/* Animated trucks */}
      {TRUCKS.map((truck) => (
        <div
          key={truck.id}
          className="absolute left-0 flex items-center gap-1 text-accent animate-truck-move"
          style={{
            top: `${truck.y}%`,
            animationDuration: `${truck.speed}s`,
            animationDelay: `${truck.delay}s`,
          }}
        >
          <Truck className="h-4 w-4 text-accent drop-shadow-[0_0_8px_rgba(255,106,0,0.5)]" />
        </div>
      ))}

      {/* Load pins */}
      {PINS.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className="absolute group cursor-pointer"
          style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -50%)" }}
          onMouseEnter={() => setActivePin(pin.id)}
          onMouseLeave={() => setActivePin(null)}
          onFocus={() => setActivePin(pin.id)}
          onBlur={() => setActivePin(null)}
          aria-label={`Load in ${pin.label}: ${pin.value}`}
        >
          <div
            className={cn(
              "relative flex items-center justify-center transition-transform duration-200",
              activePin === pin.id ? "scale-125" : "animate-pin-pulse"
            )}
            style={{ animationDelay: `${pin.delay}s` }}
          >
            <MapPin
              className={cn(
                "h-5 w-5 transition-colors",
                activePin === pin.id ? "text-accent" : "text-primary"
              )}
            />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          {activePin === pin.id && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass-panel rounded-lg px-3 py-2 whitespace-nowrap z-10 animate-fade-in">
              <p className="text-xs font-semibold text-foreground">{pin.label}</p>
              <p className="text-sm font-bold text-accent">{pin.value}</p>
            </div>
          )}
        </button>
      ))}

      {/* Live indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 glass-panel rounded-full px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Live Network</span>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-4 right-4 glass-panel rounded-xl px-4 py-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Loads</p>
        <p className="text-2xl font-bold stat-number text-foreground">2,847</p>
      </div>
    </div>
  );
}
