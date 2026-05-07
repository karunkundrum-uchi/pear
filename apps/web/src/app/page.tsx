import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fff7f4_0%,#fffdf8_50%,#f6efe7_100%)]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <span className="text-sm font-bold tracking-widest text-[#7b4f45] uppercase">Pear</span>
        <Link
          href="/sign-in"
          className="rounded-full bg-[#2d201c] px-4 py-2 text-sm font-medium text-white hover:bg-[#473632] transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-8 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#f4e4de] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#7b4f45]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7b4f45]" />
          Intentional friction
        </div>
        <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-[#2d201c] sm:text-6xl">
          Block doomscrolling<br />when you're most likely to slip.
        </h1>
        <p className="mt-6 mx-auto max-w-xl text-lg leading-8 text-[#6b544e]">
          Time-boxed blocks, personal pattern tracking, and an accountability layer that respects your privacy.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-full bg-[#2d201c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#473632] transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-[#ddd0cb] bg-white px-6 py-3 text-sm font-semibold text-[#473632] hover:bg-[#fdf6f4] transition-colors"
          >
            Open dashboard
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-8 pb-24">
        <div className="grid gap-5 sm:grid-cols-3">
          <FeatureCard
            icon={<ShieldIcon />}
            title="Block at the right time"
            body="Set windows for your highest-risk hours. The blocker only steps in when you're most likely to spiral."
          />
          <FeatureCard
            icon={<ChartIcon />}
            title="See your patterns"
            body="Track which sites pull you in and how you got through the block — waited, reasoned, or closed the tab."
          />
          <FeatureCard
            icon={<PeopleIcon />}
            title="Accountable, not surveilled"
            body="Share override activity with friends at the detail level you choose. They see what you allow, nothing more."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-8 pb-28">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6d62]">How it works</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          <Step number="1" title="Set your windows" body="Pick the days and hours you want protection. Pear only blocks during those windows." />
          <Step number="2" title="Choose your sites" body="Add the sites that tend to eat your time. The blocker intercepts them during active windows." />
          <Step number="3" title="Invite a friend" body="Connect with someone you trust. They'll know when you slip — and can ping you back." />
        </div>
      </section>
    </main>
  )
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white/80 p-6 ring-1 ring-[#eadcd7] shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4e4de] text-[#7b4f45]">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#2d201c]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6b544e]">{body}</p>
    </div>
  )
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4e4de] text-sm font-bold text-[#7b4f45]">
        {number}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-[#2d201c]">{title}</h4>
        <p className="mt-1 text-sm leading-6 text-[#6b544e]">{body}</p>
      </div>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="22">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="22">
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="22">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
