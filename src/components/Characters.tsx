import { useEffect, useState } from "react";
import { fetchAllCharacter } from "../services/CharacterApi";

interface Character {
  id: number;
  image: string;
  name: string;
  species: string;
}

const Characters = () => {
  const [characters, setCharacters] = useState<Character[]>([]);

  useEffect(() => {
    const getCharacters = async () => {
      const data = await fetchAllCharacter();
      setCharacters(data);
    };
    getCharacters();
  }, []);

  return (
    <div>
      <h1>Characters</h1>
      <ul>
        {characters.map((character) => (
          <li key={character.id}>
            <img src={character.image} alt={character.name} />
            <p>{character.name}</p>
            <p>{character.species}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Characters;
