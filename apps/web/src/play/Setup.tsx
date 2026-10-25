import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { PracticeSettings } from './host';
import { PLAY_PATH } from './config';
import { LANGS, lang, setLang, t, tn, type Lang } from '../i18n';

const BOT_CHOICES = [1, 2, 3, 4, 5];

export function Setup({ initial, onStart }: { initial: PracticeSettings; onStart: (s: PracticeSettings) => void }) {
  const [bots, setBots] = useState(initial.bots);
  const [name, setName] = useState(initial.name);
  useDocumentTitle(t('meta.playTitle'));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({ bots, name: name.trim() });
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar showLanguage />
      <main className="flex-1 grid place-items-center px-5 pb-16 pt-4">
        <form
          onSubmit={submit}
          className="frame elev-2 relative w-full max-w-xl overflow-hidden rounded-[28px] [--r:28px] bg-kohle-raised px-7 py-10 sm:px-12 sm:py-12"
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(232,98,44,.2),transparent)]" aria-hidden="true" />
          <h1 className="h-display relative text-[clamp(2.2rem,6vw,3.2rem)]">{t('setup.title')}</h1>
          <p className="relative mt-3 max-w-md text-pergament-dim">{t('setup.lead')}</p>

          <fieldset className="relative mt-9">
            <legend className="text-sm text-pergament-dim">{t('setup.howMany')}</legend>
            <div className="mt-3 flex flex-wrap gap-3" role="radiogroup">
              {BOT_CHOICES.map((n) => (
                <label key={n} className="bot-choice">
                  <input
                    type="radio"
                    name="bots"
                    value={n}
                    checked={bots === n}
                    onChange={() => setBots(n)}
                    className="sr-only"
                  />
                  <span className="font-display text-2xl">{n}</span>
                </label>
              ))}
            </div>
            <p className="mt-4 text-sm text-pergament-mute">{tn('setup.summary', bots, { total: bots + 1 })}</p>
          </fieldset>

          <div className="relative mt-8">
            <label htmlFor="player-name" className="block text-sm text-pergament-dim">
              {t('setup.name')}
            </label>
            <input
              id="player-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              autoComplete="nickname"
              placeholder={t('you')}
              className="mt-2.5 w-full max-w-xs rounded-full bg-russ/70 px-5 py-3 font-semibold text-pergament shadow-[inset_0_0_0_1px_rgba(198,161,91,.35),inset_0_2px_6px_rgba(0,0,0,.4)] placeholder:text-pergament-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-messing"
            />
          </div>

          <div className="relative mt-10 flex flex-wrap items-center gap-5">
            <button type="submit" className="btn btn-glut text-base">
              {t('setup.deal')}
            </button>
            <a href={`${PLAY_PATH}?create=1`} className="link text-[15px]">
              {t('setup.friends')}
            </a>
          </div>
        </form>
      </main>
    </div>
  );
}

/** Logo on the left, then whatever the screen needs. The language switch is left out during a game. */
export function TopBar({ children, showLanguage = false }: { children?: ReactNode; showLanguage?: boolean }) {
  return (
    <header className="relative z-30 mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
      <a href="/" className="logo-mark ring-focus [--logo:60px] sm:[--logo:64px] transition-transform duration-300 hover:-translate-y-0.5 active:scale-95" aria-label={t('home.aria')}>
        <img src="/brand_assets/logo-web.jpg" alt="Schwarzer Peter" />
      </a>
      {children}
      {showLanguage && <LangSwitch />}
    </header>
  );
}

export function LangSwitch() {
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button key={l} type="button" lang={l} title={LANGS[l]} aria-pressed={l === lang} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = lang;
  }, [title]);
}
