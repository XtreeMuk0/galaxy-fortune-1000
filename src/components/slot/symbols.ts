import wild from "@/assets/sym-wild.png";
import scatter from "@/assets/sym-scatter-logo.png";
import logo from "@/assets/sym-logo.png.asset.json";
import planet from "@/assets/sym-planet.png";
import ufo from "@/assets/sym-ufo.png";
import comet from "@/assets/sym-comet.png";
import crystal from "@/assets/sym-crystal.png";
import orb from "@/assets/sym-orb.png";
import type { SymbolId } from "@/lib/slot/engine";

export const SYMBOL_IMG: Partial<Record<SymbolId, string>> = {
  WILD: wild, SCATTER: scatter, ASTRO: logo.url, PLANET: planet, UFO: ufo, COMET: comet, CRYSTAL: crystal, ORB: orb,
};
export const SYMBOL_NAME: Record<SymbolId, string> = {
  WILD: "Galaxia (Wild)", SCATTER: "Scatter", ASTRO: "Logo del estudio", PLANET: "Planeta",
  UFO: "OVNI", COMET: "Cometa", CRYSTAL: "Cristal", A: "A", K: "K", Q: "Q", J: "J", ORB: "Orbe multiplicador",
};
export const ALL_SYMBOLS: SymbolId[] = ["WILD","SCATTER","ASTRO","PLANET","UFO","COMET","CRYSTAL","A","K","Q","J"];
