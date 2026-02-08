import TemplatesTable from "./templates/table";

export default function Home() {
	return (
		<main className="p-6">
			<h1 className="w-full text-xl py-12">
				Signatures des chartes et contrats
			</h1>
			<nav className="w-full flex flex-row gap-1 mb-12">
				<button type="button" className="px-6 py-3 bg-zinc-700 rounded-t-lg">
					Modèles
				</button>
				<button type="button" className="px-6 py-3 bg-zinc-700 rounded-t-lg">
					Documents
				</button>
			</nav>
			<section className="p-6 bg-zinc-900 w-full">
				<TemplatesTable />
			</section>
		</main>
	);
}
