import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <Loader2 className={cn("size-4 animate-spin", className)} />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}
