import Link from "next/link"

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <div className="max-w-2xl">
        <p className="mb-3 text-sm font-semibold text-teal-700">Pear</p>
        <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
          Block doomscrolling only when you are most likely to slip.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
          Configure your high-risk windows, install the extension, and use a short override flow when you
          intentionally choose to continue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth"
            className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
