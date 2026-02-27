'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

export function FeedbackWidget() {
  const t = useTranslations('feedback');

  const FEEDBACK_TYPES = [
    { value: 'bug', label: t('types.bugReport'), icon: Bug, color: 'text-red-400 border-red-400/50 bg-red-400/10' },
    { value: 'feature', label: t('types.featureRequest'), icon: Lightbulb, color: 'text-amber-400 border-amber-400/50 bg-amber-400/10' },
    { value: 'general', label: t('types.general'), icon: MessageCircle, color: 'text-sky-400 border-sky-400/50 bg-sky-400/10' },
  ] as const;

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
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-white shadow-xl shadow-primary/25 ring-2 ring-white/30 ring-offset-2 ring-offset-background transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/30 hover:ring-white/50 active:scale-95"
        aria-label={t('buttonAriaLabel')}
      >
        <MessageSquarePlus className="h-5 w-5" />
        <span className="hidden sm:inline">{t('buttonLabel')}</span>
      </button>

      {/* Dialog — fully opaque */}
      <DialogPrimitive.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogPrimitive.Portal>
          {/* Fully opaque black overlay */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          {/* Solid dialog panel */}
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border bg-card p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">

            {/* Close button */}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            {/* Header */}
            <div className="flex flex-col space-y-1.5 sm:text-left">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                {t('dialogTitle')}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {t('dialogDescription')}
              </DialogPrimitive.Description>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <p className="text-lg font-semibold">{t('thankYou')}</p>
                <p className="text-sm text-muted-foreground">{t('weAppreciate')}</p>
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
                    placeholder={t('messagePlaceholder')}
                    className="w-full rounded-xl border border-border/50 bg-secondary px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-none"
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
                    placeholder={t('emailPlaceholder')}
                    className="w-full rounded-xl border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                      {t('sendingButton')}
                    </>
                  ) : (
                    t('submitButton')
                  )}
                </button>
              </form>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
