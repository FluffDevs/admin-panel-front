export default function Home() {
	return (
		<table className="w-full">
			<thead>
				<tr>
					<th>ID</th>
					<th>Nom</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody className="text-center">
				<tr>
					<td>1</td>
					<td>Charte de confidentialité</td>
					<td className="flex flex-row gap-3 justify-center">
						<button type="button">Voir</button>
						<button type="button">Modifier</button>
						<button type="button">Supprimer</button>
					</td>
				</tr>
			</tbody>
		</table>
	);
}
