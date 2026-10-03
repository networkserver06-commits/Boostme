import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  if (!toggleTheme) return null;
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 text-slate-300 transition hover:border-cyan-200/25 hover:bg-white/[.06] hover:text-white ${compact ? "h-10 w-10" : "px-3 py-2 text-xs font-medium"}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
