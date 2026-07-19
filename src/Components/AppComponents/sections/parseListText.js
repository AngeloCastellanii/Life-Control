/**
 * Detecta líneas de lista (viñetas, numeración, °, -, *, etc.)
 * y las convierte en ítems de checklist.
 */
const BULLET_RE =
   /^[\s]*(?:[•●◦▪▫■□★☆✓✔✕✖°\*·∙]|[-–—‒−])\s+(.*)$/u;
const NUMBERED_RE = /^[\s]*(?:\d+[.)\]:-]|\(\d+\)|[a-zA-Z][.)])\s+(.*)$/u;

function stripLine(line) {
   const raw = (line ?? '').replace(/\r/g, '').trim();
   if (!raw) {
      return null;
   }

   const bullet = raw.match(BULLET_RE);
   if (bullet?.[1]?.trim()) {
      return { text: bullet[1].trim(), listed: true };
   }

   const numbered = raw.match(NUMBERED_RE);
   if (numbered?.[1]?.trim()) {
      return { text: numbered[1].trim(), listed: true };
   }

   return { text: raw, listed: false };
}

/**
 * @param {string} text
 * @returns {{ text: string, done: boolean }[]}
 */
export function parseListText(text) {
   if (!text || !String(text).trim()) {
      return [];
   }

   const lines = String(text)
      .split(/\n+/)
      .map(stripLine)
      .filter(Boolean);

   if (lines.length === 0) {
      return [];
   }

   const listedCount = lines.filter((line) => line.listed).length;
   const looksLikeList = listedCount >= 1 && listedCount >= Math.ceil(lines.length * 0.4);

   if (looksLikeList) {
      return lines
         .filter((line) => line.listed || lines.length === 1)
         .map((line) => ({ text: line.text, done: false }));
   }

   // Varias líneas sin viñetas: cada línea es un ítem
   if (lines.length >= 2) {
      return lines.map((line) => ({ text: line.text, done: false }));
   }

   // Una sola línea con separadores tipo "a, b, c" o "a; b; c"
   const single = lines[0].text;
   if (/[;|]/.test(single) || (single.includes(',') && single.split(',').length >= 3)) {
      return single
         .split(/[;|]/)
         .flatMap((chunk) => chunk.split(','))
         .map((part) => part.trim())
         .filter(Boolean)
         .map((part) => ({ text: part, done: false }));
   }

   return [{ text: single, done: false }];
}

/** True si el texto parece una lista (vale la pena convertir). */
export function looksLikeListText(text) {
   const items = parseListText(text);
   return items.length >= 2 || (items.length === 1 && /[\n•●◦°\*\-–—]|\d+[.)]/.test(text));
}
