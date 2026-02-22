'use client';

import { useState } from 'react';
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-400 border-red-400/50 bg-red-400/10' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-400 border-amber-400/50 bg-amber-400/10' },
  { value: 'general', label: 'General', icon: MessageCircle, color: 'text-sky-400 border-sky-400/50 bg-sky-400/10' },
] as const;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setType('general');
    setMessage('');
    setEmail('');
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) return;

    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page: window.location.pathname,
          email: email.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 2000);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setOpen(true); setSuccess(false); }}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve RubinOT Stats. Your feedback is anonymous unless you provide an email.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="text-lg font-semibold">Thanks for your feedback!</p>
              <p className="text-sm text-muted-foreground">We appreciate your input.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                {FEEDBACK_TYPES.map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors ${
                      type === value
                        ? color
                        : 'border-border/50 text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-none"
                  required
                  minLength={5}
                />
              </div>

              {/* Email (optional) */}
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional — for follow-up)"
                  className="w-full rounded-xl border border-border/50 bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || message.trim().length < 5}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
