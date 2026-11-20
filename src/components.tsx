import { LanguageSelector } from "./LanguageSelector";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Utensils,
  Coffee,
  Plane,
  Sparkles,
  ArrowLeft,
  Globe,
  Sun,
  Moon,
} from "lucide-react";
import type { Member } from "../shared/engine";
import { useApp } from "./context";
export const icons: Record<string, typeof Utensils> = {
  dinner: Utensils,
  coffee: Coffee,
  trip: Plane,
  other: Sparkles,
};
export function Vibe({
  type = "dinner",
  large = false,
}: {
  type?: string;
  large?: boolean;
}) {
  const Icon = icons[type] || Sparkles;
  return (
    <span className={`vibe ${large ? "large" : ""} ${type}`}>
      <Icon size={large ? 30 : 22} />
    </span>
  );
}
export function Avatar({
  member,
  size = "",
}: {
  member: Pick<Member, "name"> & { avatarUrl?: string };
  size?: string;
}) {
  const n = member.name;
  const color = [...n].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  return (
    <span className={`avatar color-${color} ${size}`} aria-label={n}>
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        n
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
export function Button({
  children,
  onClick,
  type = "button",
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`button ${secondary ? "secondary" : ""}`}
    >
      {children}
    </button>
  );
}
export function Empty({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sparkles size={28} />
      </span>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
      {children}
    </div>
  );
}
export function PageHead({
  title,
  sub,
  children,
  back = false,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
  back?: boolean;
}) {
  const { t } = useApp();
  const navigate = useNavigate();
  return (
    <div className="page-heading">
      <div>
        {back && (
          <button className="back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            {t("back")}
          </button>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
export function Controls() {
  const { lang, setLang, theme, setTheme, t } = useApp();
  return (
    <div className="controls">
      <LanguageSelector compact />
      <button
        aria-label={t("theme")}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </div>
  );
}
