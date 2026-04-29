import Link from "next/link"

export default function AuthPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">Pear</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Continue with Clerk</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Pear now uses Clerk for sign-in. Continue to the hosted auth flow to use email or Google.
        </p>
        <div className="mt-6 grid gap-3">
          <Link
            className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 hover:bg-slate-50"
            href="/sign-up"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  )
}
