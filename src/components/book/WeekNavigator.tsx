import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MAX_WEEKS_AHEAD } from "@/lib/booking";

type Props = {
  weekOffset: number;
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
};

export function WeekNavigator({ weekOffset, weekStart, onPrev, onNext }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={weekOffset === 0}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </Button>
      <div className="text-sm font-medium">
        Week of {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
        <span className="ml-2 text-muted-foreground">({weekOffset + 1} / {MAX_WEEKS_AHEAD})</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={weekOffset === MAX_WEEKS_AHEAD - 1}
      >
        Next <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
