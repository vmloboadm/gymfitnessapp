import type { Metadata } from "next";
import { TvDisplay } from "./TvDisplay";

export const metadata: Metadata = {
  title: "TV · GymFitness Campos",
  description: "Painel da TV da academia: patrocinadores, dicas e ranking.",
};

/**
 * Rota da TV da academia (tela cheia, sem login).
 * Lê a tabela tv_content (Ticket 7); se ainda não existir conteúdo,
 * exibe patrocinadores ativos + slides padrão de motivação.
 */
export default function TvPage() {
  return <TvDisplay />;
}
