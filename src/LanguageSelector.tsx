import { languageOptions, type Locale } from "./i18n";
import { useApp } from "./context";
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useApp();
  const selected = languageOptions.find((option) => option.value === lang)!;
  return (
    <span
      className={compact ? "language-picker compact" : "language-picker"}
      dir="ltr"
    >
      {compact && (
        <span className="language-value" aria-hidden="true">
          {selected.flag} {lang.toUpperCase()}
        </span>
      )}
      <select
        aria-label={t("language")}
        value={lang}
        onChange={(event) => setLang(event.target.value as Locale)}
      >
        {languageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.flag} {option.value.toUpperCase()} — {option.name}
          </option>
        ))}
      </select>
    </span>
  );
}
