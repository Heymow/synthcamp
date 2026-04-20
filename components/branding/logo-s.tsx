export interface LogoSProps {
  size?: number;
  className?: string;
}

export function LogoS({ size = 32, className }: LogoSProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SynthCamp logo"
      role="img"
    >
      <path
        d="M30 25C30 20 35 15 45 15H70C75 15 80 19 80 24C80 29 76 33 71 33H45C40 33 38 35 38 38C38 41 40 43 45 43H70C85 43 90 53 90 63C90 73 85 85 70 85H30C25 85 20 81 20 76C20 71 24 67 29 67H70C75 67 77 65 77 62C77 59 75 57 70 57H45C30 57 25 47 25 37C25 32 27 28 30 25Z"
        fill="url(#logoGradient)"
      />
      <defs>
        <linearGradient
          id="logoGradient"
          x1="20"
          y1="15"
          x2="90"
          y2="85"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
