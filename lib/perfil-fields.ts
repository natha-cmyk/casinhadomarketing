// Constantes/UX compartilhadas dos campos de Perfil (onboarding + Personalização).
export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
export const RAMOS = ["Saúde", "Consultoria", "Imobiliária", "Engenharia", "Direito", "Educação", "Tecnologia", "Comércio / Varejo", "Alimentação", "Beleza & Estética", "Contabilidade", "Marketing & Publicidade", "Coworking / Espaços", "Serviços financeiros", "Turismo & Hotelaria", "Construção civil", "Indústria"];

// máscara BR: (DD) 9XXXX-XXXX (celular) ou (DD) XXXX-XXXX (fixo)
export function maskPhone(v: string): string {
  const d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
