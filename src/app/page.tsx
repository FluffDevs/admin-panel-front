import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen relative bg-zinc-50 dark:bg-black font-sans">
      {/* Background artwork from charte graphique */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/chartegraphique/FluffRadio-CharteGraphique-Noka-x-Pawl/FluffRadio-CG-Full/LivreePNG-FluffRadio-Communication-Livery/FluffRadio-color-background-livery.png"
          alt="background"
          fill
          className="object-cover opacity-90"
          priority
        />
      </div>

      {/* Header is provided globally by the app layout; avoid duplicating it here */}

      <main className="max-w-6xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12">
        <section className="flex-1">
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight text-zinc-900 dark:text-zinc-50">Fluff Radio — l&apos;univers doux et vibrant</h1>
          <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-300 max-w-xl">
            Bienvenue sur le panneau d&apos;administration. Gérez les musiques, uploadez de nouveaux titres et
            pilotez la programmation de votre station en toute simplicité.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link href="/login" className="inline-flex items-center justify-center btn-fluff">Se connecter</Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center btn-outline-fluff">Aller au dashboard</Link>
          </div>

          <div className="mt-8 text-sm text-zinc-500">Crédits: Fluff Radio — Charte graphique fournie</div>
        </section>

        <aside className="w-full lg:w-1/3">
          <div className="bg-white/90 dark:bg-black/70 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
            <h4 className="font-semibold mb-3">Aperçu</h4>
            <Image src="/chartegraphique/FluffRadio-CharteGraphique-Noka-x-Pawl/FluffRadio-CG-Full/LivreePNG-FluffRadio-Communication-Livery/FluffRadio-icon-livery.png" alt="icon" width={240} height={240} className="mx-auto" />
          </div>
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Fluff Radio — Tous droits réservés
      </footer>
    </div>
  );
}
