import type { Metadata } from "next";
import MapaInterativo from "./MapaInterativo";

export const metadata: Metadata = {
  title: "Mapa Interativo · Festa Junina 2026",
  description:
    "Mapa interativo da Festa Junina 2026 do Colégio Marista de Brasília: locais, ginásio, programação ao vivo e cardápio com calculadora.",
};

export default function MapaPage() {
  return <MapaInterativo />;
}
