interface SectionLabelProps {
  number: string;
  label: string;
}

export default function SectionLabel({ number, label }: SectionLabelProps) {
  return (
    <div className="text-[10px] tracking-[0.3em] text-[#d4a574] mb-4">
      {number} / {label}
    </div>
  );
}
