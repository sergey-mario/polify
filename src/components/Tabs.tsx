interface TabsProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <nav className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          className={`tabs__tab ${t.key === active ? 'tabs__tab--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
