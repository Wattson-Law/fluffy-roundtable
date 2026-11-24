/** Prefer an actual contrasting remark; don't label an ordinary comment as a rebuttal. */
export function selectComment(rows: { comments: string[] }[]) {
  const all = rows.flatMap((t, index) =>
    t.comments
      .filter((c) => !!c.trim())
      .map((c) => ({
        index,
        excerpt: c.trim().slice(0, 150),
        contrast: /不过|但[是我]|相反|不一定|未必|并非|不认同|不太同意|也有|不一样/.test(c),
      })),
  );
  return all.find((c) => c.contrast) ?? all.find((c) => c.excerpt.length >= 6) ?? all[0];
}
