// Dialog for the teacher to propose a reschedule to the student.
// Two modes:
//   - "Let student pick" → just sends a message; student picks a new slot
//   - "Suggest a time" → teacher picks a slot, student approves/declines
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string | null;
  currentSlotIso: string | null;
  studentName: string | null;
  onSent?: () => void;
};

export function TeacherRescheduleDialog({ open, onOpenChange, lessonId, currentSlotIso, studentName, onSent }: Props) {
  const [mode, setMode] = useState<"student_picks" | "suggest">("student_picks");
  const [message, setMessage] = useState("");
  const [proposed, setProposed] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setMode("student_picks");
    setMessage("");
    setProposed("");
  }

  async function submit() {
    if (!lessonId) return;
    if (mode === "suggest" && !proposed) {
      toast({ title: "Pick a date & time", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const slotIso = mode === "suggest" ? new Date(proposed).toISOString() : null;
    const { error } = await supabase.rpc("teacher_propose_reschedule", {
      _lesson_id: lessonId,
      _message: message.trim() || null,
      _proposed_slot: slotIso,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reschedule request sent", description: `${studentName ?? "Student"} will see it on their dashboard.` });
    reset();
    onOpenChange(false);
    onSent?.();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule lesson</DialogTitle>
          <DialogDescription>
            {studentName ? `Send ${studentName} a reschedule request.` : "Send the student a reschedule request."}
            {currentSlotIso && (
              <span className="mt-1 block text-xs">
                Currently: {new Date(currentSlotIso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("student_picks")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                mode === "student_picks" ? "border-primary bg-primary/5" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">Let student pick</div>
              <div className="text-xs text-muted-foreground">They choose a new slot.</div>
            </button>
            <button
              type="button"
              onClick={() => setMode("suggest")}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                mode === "suggest" ? "border-primary bg-primary/5" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">Suggest a time</div>
              <div className="text-xs text-muted-foreground">Student approves or declines.</div>
            </button>
          </div>

          {mode === "suggest" && (
            <div>
              <Label htmlFor="proposed">Proposed date &amp; time</Label>
              <Input
                id="proposed"
                type="datetime-local"
                value={proposed}
                step={1800}
                onChange={(e) => setProposed(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">Use 30-minute increments. Within 5:30 AM – 7:00 PM Peru time.</p>
            </div>
          )}

          <div>
            <Label htmlFor="message">Message {mode === "student_picks" ? "(why are you rescheduling?)" : "(optional)"}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Sorry, something came up — could we move this lesson?"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
