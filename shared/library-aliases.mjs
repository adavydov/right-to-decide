export const isLibraryAlias = source => source.reading.kind === 'alias';
export const visibleLibrarySources = sources => sources.filter(source => !isLibraryAlias(source));
export function libraryAliasTargets(source, sources) {
  if (!isLibraryAlias(source)) return [];
  return source.links.filter(link => link.label === 'Карточки этой книги').flatMap(link => {
    const match = /^https:\/\/adavydov\.github\.io\/right-to-decide\/library\/(ref-\d+)\/$/.exec(link.url);
    const target = match && sources.find(item => item.id === match[1] && !isLibraryAlias(item) && item.cardCount > 0);
    return target ? [target] : [];
  });
}
