import { cn } from "@/lib/utils";

interface LoadingLogoProps {
  className?: string;
  size?: number | string;
}

export function LoadingLogo({ className, size = 32 }: LoadingLogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin"
      >
        <defs>
          <linearGradient id="loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        {/* Top Swoosh */}
        <path
          d="M50 10C72.0914 10 90 27.9086 90 50C90 55.4523 88.9087 60.6496 86.9317 65.3857L77.102 61.2829C78.3303 57.7709 79 53.9616 79 50C79 33.9837 66.0163 21 50 21L50 10Z"
          fill="url(#loader-gradient)"
        />
        {/* Bottom Swoosh */}
        <path
          d="M50 90C27.9086 90 10 72.0914 10 50C10 44.5477 11.0913 39.3504 13.0683 34.6143L22.898 38.7171C21.6697 42.2291 21 46.0384 21 50C21 66.0163 33.9837 79 50 79L50 90Z"
          fill="url(#loader-gradient)"
        />
        {/* Arrow Heads (Subtle) */}
        <path
          d="M86.9317 65.3857L95 62L89 74L86.9317 65.3857Z"
          fill="#06b6d4"
        />
        <path
          d="M13.0683 34.6143L5 38L11 26L13.0683 34.6143Z"
          fill="#2563eb"
        />
      </svg>
    </div>
  );
}
