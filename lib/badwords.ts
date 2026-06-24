// Filtro de nomes do jogador — evita palavrão, conteúdo sexual e ofensas no
// ranking/logs (evento escolar/infantil do Colégio Marista).
//
// Como funciona: normaliza o texto (minúsculas, sem acento, desfaz "leet" como
// 0→o / 3→e / @→a, remove espaços e pontuação, junta letras repetidas) e checa
// se sobrou alguma raiz ofensiva. A lista é por RAIZ (substring), então
// "putona", "put@", "p u t a" e "puuuta" caem todos.
//
// Curadoria: incluímos só raízes com baixa colisão com nomes reais. De
// propósito NÃO entram tokens curtos/ambíguos que aparecem em nomes legítimos
// (ex.: "pau" em Paulo, "rola" em Carolina, "pinto"/"pica" como sobrenome,
// "cu" em Cuca). Para ajustar, edite a lista BAD abaixo.

const BAD: string[] = [
  // palavrões / baixo calão
  "caralho", "porra", "poha", "buceta", "boceta", "xoxota", "xereca", "ppk",
  "merda", "bosta", "cacete", "escroto", "arrombado", "arrombada",
  "cuzao", "cuzud", "cuzinho", "corno", "cornud", "cornan",
  "puta", "putona", "putinh", "putaria", "puteiro", "vagabund", "vadia",
  "biscate", "piranhuda", "safada", "safado", "babaca",
  "desgracad", "fdp", "fudid", "foder", "fodase", "fodac", "vtnc", "vsf",
  "vaitomarnocu", "vaisefuder", "pqp", "filhadaputa", "filhodaputa",
  // sexual
  "sexo", "sexual", "penis", "piru", "piroca", "pintao",
  "vagina", "xota", "boquet", "punhet", "siririca", "broxa", "tesao", "tesud",
  "gozada", "gozar", "transar", "transei", "chupame", "masturb",
  "porno", "nude", "nudez", "peituda", "seios", "putaquepariu",
  // ofensas / slurs
  "viado", "viadinho", "bichinha", "boiola", "baitola", "traveco",
  "sapatao", "sapatona", "crioulo", "macumbeir", "retardad", "mongoloid",
  // drogas (contexto escolar)
  "maconha", "cocaina", "crackudo", "drogad", "traficant",
];

function normalize(s: string): string {
  let t = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  t = t
    .replace(/[@4]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/9/g, "g");
  t = t.replace(/[^a-z]/g, "");        // tira espaços, pontuação, números restantes
  t = t.replace(/(.)\1{2,}/g, "$1");   // junta 3+ letras repetidas ("puuuta" -> "puta")
  return t;
}

/** true se o nome é aceitável (sem palavrão/sexual/ofensa). */
export function isNameClean(name: string): boolean {
  const t = normalize(name);
  if (!t) return true;
  return !BAD.some((w) => t.includes(normalize(w)));
}
