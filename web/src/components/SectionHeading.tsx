type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: Props) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-display text-2xl font-bold text-ink-strong leading-tight">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-medium">
          {description}
        </p>
      ) : null}
    </div>
  );
}
