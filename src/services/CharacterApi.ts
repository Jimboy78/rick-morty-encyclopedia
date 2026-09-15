export interface Character {
  id: number;
  name: string;
  species: string;
  image: string;
}

export async function fetchAllCharacter(): Promise<Array<Character>> {
  const response = await fetch("https://rickandmortyapi.com/api/character");
  const data = await response.json();
  return data.results;
}
