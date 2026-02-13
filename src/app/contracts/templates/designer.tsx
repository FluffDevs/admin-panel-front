"use client";

import { BLANK_A4_PDF, type Template } from "@pdfme/common";
import { useEffect, useRef } from "react";

export default function Home() {
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let designer: any;
		const load = async () => {
			const { Designer } = await import("@pdfme/ui");
			const template: Template = { basePdf: BLANK_A4_PDF, schemas: [] };
			const domContainer = containerRef.current;
			if (!domContainer) return;
			// Initialize Designer with the container and the template.
			// The options shape may vary; this uses `el` and `template` which works
			// with the runtime import approach. Adjust if your version expects a
			// different option name (e.g. `container`).
			designer = new Designer({ domContainer, template });
		};

		load();

		return () => {
			if (designer && typeof designer.destroy === "function") {
				designer.destroy();
			}
		};
	}, []);

	return (
		<div className="w-full">
			<h1 className="text-xl py-6">Éditeur de modèle</h1>
			<div id="designer-pdfme" ref={containerRef} />
		</div>
	);
}
