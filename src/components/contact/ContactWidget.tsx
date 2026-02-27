'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

const CONTACT_TYPES = [
  { value: 'discord', label: 'Discord', color: 'text-indigo-400 border-indigo-400/50 bg-indigo-400/10' },
  { value: 'telegram', label: 'Telegram', color: 'text-sky-400 border-sky-400/50 bg-sky-400/10' },
] as const;

export function ContactWidget() {
  const t = useTranslations('contact');

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [contactType, setContactType] = useState<string>('discord');
  const [contactValue, setContactValue] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setName('');
    setContactType('discord');
    setContactValue('');
    setMessage('');
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5 || !contactValue.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          contactType,
          contactValue: contactValue.trim(),
          message: message.trim(),
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
      {/* Floating Button — bottom-left (FeedbackWidget is bottom-right) */}
      <button
        onClick={() => { setOpen(true); setSuccess(false); }}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-indigo-600/25 ring-2 ring-white/30 ring-offset-2 ring-offset-background transition-all hover:scale-105 hover:shadow-2xl hover:shadow-indigo-600/30 hover:ring-white/50 active:scale-95"
        aria-label={t('buttonAriaLabel')}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">{t('buttonLabel')}</span>
      </button>

      {/* Dialog */}
      <DialogPrimitive.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border bg-card p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">

            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

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
                <p className="text-sm text-muted-foreground">{t('weWillReach')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name (optional) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {t('nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    maxLength={100}
                    className="w-full rounded-xl border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Contact Type */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {t('contactTypeLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONTACT_TYPES.map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setContactType(value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                          contactType === value
                            ? color
                            : 'border-border/50 text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact Handle */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {t('contactHandleLabel')}
                  </label>
                  <input
                    type="text"
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    placeholder={contactType === 'discord' ? t('discordPlaceholder') : t('telegramPlaceholder')}
                    required
                    maxLength={255}
                    className="w-full rounded-xl border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Message */}
                <div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('messagePlaceholder')}
                    className="w-full rounded-xl border border-border/50 bg-secondary px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[100px] resize-none"
                    required
                    minLength={5}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || message.trim().length < 5 || !contactValue.trim()}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
