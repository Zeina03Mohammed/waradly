'use client';

interface Category {
  id: string;
  name: string;
}

/** Button/chip picker instead of a native <select> — the browser's own open-dropdown list
 * can't be styled at all, so it always looks out of place next to the rest of the theme. */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (categories.length === 0) {
    return <p className="text-sm text-navy-400">No categories available yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={
              selected
                ? 'rounded-full bg-navy-950 px-4 py-1.5 text-sm font-medium text-white transition-colors'
                : 'rounded-full border border-navy-100 px-4 py-1.5 text-sm text-navy-600 transition-colors hover:border-navy-400 hover:text-navy-950'
            }
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
