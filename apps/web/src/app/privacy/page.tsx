import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Pear",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fff7f4_0%,#fffdf8_50%,#f6efe7_100%)]">
      <nav className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="text-sm font-bold tracking-widest text-[#7b4f45] uppercase">Pear</Link>
      </nav>

      <article className="mx-auto max-w-2xl px-8 pt-10 pb-28">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6d62]">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2d201c]">Privacy Policy</h1>
        <p className="mt-3 text-sm text-[#9a6d62]">Last updated: May 14, 2026</p>

        <Section title="Overview">
          Pear is a Chrome extension and web dashboard that helps you reduce doomscrolling by blocking
          high-risk websites during time windows you define. This policy explains what data we collect,
          how we use it, and how it is protected.
        </Section>

        <Section title="Data we collect">
          <ul className="mt-3 space-y-2 text-sm leading-7 text-[#6b544e] list-disc list-inside">
            <li><strong className="text-[#2d201c]">Account information</strong> — your email address, collected when you sign up via Clerk.</li>
            <li><strong className="text-[#2d201c]">Block configuration</strong> — the sites and time windows you choose to block, stored in Supabase.</li>
            <li><strong className="text-[#2d201c]">Override activity</strong> — when and how you dismiss a block (wait timer or typed reason), stored in Supabase.</li>
            <li><strong className="text-[#2d201c]">Browsing activity</strong> — the extension uses the <code className="text-xs bg-[#f4e4de] px-1 py-0.5 rounded text-[#7b4f45]">tabs</code> and <code className="text-xs bg-[#f4e4de] px-1 py-0.5 rounded text-[#7b4f45]">webNavigation</code> APIs to detect when you visit a blocked site. URLs are matched locally against your block list and are <strong>not</strong> transmitted to our servers.</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          We use your data solely to operate Pear: enforcing your block windows, displaying your override
          history in the dashboard, and powering the optional social accountability features you opt into
          with friends. We do not sell your data, share it with advertisers, or use it for any purpose
          outside the Pear product.
        </Section>

        <Section title="Social features">
          If you connect with friends inside Pear, your override activity may be visible to them at the
          detail level you configure. You can disable sharing at any time from your dashboard settings.
          Friends cannot see your full browsing history — only override events you have chosen to share.
        </Section>

        <Section title="Third-party services">
          <ul className="mt-3 space-y-2 text-sm leading-7 text-[#6b544e] list-disc list-inside">
            <li><strong className="text-[#2d201c]">Clerk</strong> — handles authentication. Subject to <a href="https://clerk.com/privacy" className="underline text-[#7b4f45]" target="_blank" rel="noopener noreferrer">Clerk's privacy policy</a>.</li>
            <li><strong className="text-[#2d201c]">Supabase</strong> — stores your configuration and override history. Subject to <a href="https://supabase.com/privacy" className="underline text-[#7b4f45]" target="_blank" rel="noopener noreferrer">Supabase's privacy policy</a>.</li>
          </ul>
        </Section>

        <Section title="Data retention and deletion">
          Your data is retained as long as your account is active. To delete your account and all
          associated data, contact us at the email below and we will process the request within 30 days.
        </Section>

        <Section title="Contact">
          For privacy questions or deletion requests, email{" "}
          <a href="mailto:karunkundrum@gmail.com" className="underline text-[#7b4f45]">karunkundrum@gmail.com</a>.
        </Section>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-[#2d201c]">{title}</h2>
      {typeof children === "string" ? (
        <p className="mt-3 text-sm leading-7 text-[#6b544e]">{children}</p>
      ) : (
        children
      )}
    </section>
  )
}
